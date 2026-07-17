export interface ProjectInfo {
  startupName: string;
  industry: string;
  projectType: string;
  expectedUsers: number;
  expectedGrowth: 'stable' | 'high' | 'explosive';
  budget: number;
  region: 'us-east' | 'eu-west' | 'ap-south';
  needAI: boolean;
  needKubernetes: boolean;
  needHighAvailability: boolean;
  storageRequirement: 'low' | 'medium' | 'high' | 'enterprise';
}

export interface TerraformFiles {
  'providers.tf': string;
  'variables.tf': string;
  'main.tf': string;
  'outputs.tf': string;
}

// Convert project name to safe lower-case alphanumeric slug
function getSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'cloudpilot-app';
}

// Translate general region codes to provider-specific region strings
function getProviderRegion(provider: string, region: 'us-east' | 'eu-west' | 'ap-south'): string {
  if (provider === 'AWS') {
    switch (region) {
      case 'us-east': return 'us-east-1';
      case 'eu-west': return 'eu-west-1';
      case 'ap-south': return 'ap-south-1';
    }
  } else if (provider === 'Google Cloud Platform') {
    switch (region) {
      case 'us-east': return 'us-east1';
      case 'eu-west': return 'europe-west3';
      case 'ap-south': return 'asia-south1';
    }
  } else if (provider === 'Microsoft Azure') {
    switch (region) {
      case 'us-east': return 'eastus';
      case 'eu-west': return 'westeurope';
      case 'ap-south': return 'centralindia';
    }
  } else if (provider === 'DigitalOcean') {
    switch (region) {
      case 'us-east': return 'nyc3';
      case 'eu-west': return 'fra1';
      case 'ap-south': return 'blr1';
    }
  }
  return 'us-east-1';
}

export function generateTerraform(project: ProjectInfo, provider: string): TerraformFiles {
  const slug = getSlug(project.startupName);
  const rawRegion = project.region;
  const region = getProviderRegion(provider, rawRegion);

  switch (provider) {
    case 'AWS':
      return generateAWSTerraform(project, slug, region);
    case 'Google Cloud Platform':
      return generateGCPTerraform(project, slug, region);
    case 'Microsoft Azure':
      return generateAzureTerraform(project, slug, region);
    case 'DigitalOcean':
    default:
      return generateDOTerraform(project, slug, region);
  }
}

// ==========================================
// AWS TERRAFORM GENERATION
// ==========================================
function generateAWSTerraform(project: ProjectInfo, slug: string, region: string): TerraformFiles {
  const providersTf = `terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "Terraform"
      Industry    = "${project.industry}"
    }
  }
}
`;

  const variablesTf = `variable "project_name" {
  type        = string
  description = "The name of the project"
  default     = "${slug}"
}

variable "environment" {
  type        = string
  description = "The deployment environment"
  default     = "production"
}

variable "aws_region" {
  type        = string
  description = "The AWS region to deploy resources"
  default     = "${region}"
}

variable "vpc_cidr" {
  type        = string
  description = "The CIDR block for the VPC"
  default     = "10.0.0.0/16"
}

variable "db_username" {
  type        = string
  description = "Administrator username for the PostgreSQL database"
  default     = "cloudpilot_admin"
}

variable "db_password" {
  type        = string
  description = "Administrator password for the PostgreSQL database"
  sensitive   = true
}
`;

  let mainTf = `# Base Networking Architecture
locals {
  availability_zones = ["\${var.aws_region}a", "\${var.aws_region}b"]
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.\${count.index}.0/24"
  availability_zone       = local.availability_zones[count.index]
  map_public_ip_on_launch = true
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.\${count.index + 10}.0/24"
  availability_zone = local.availability_zones[count.index]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Dynamic Resource Definitions based on requirements
`;

  // Compute / Orchestration
  if (project.needKubernetes) {
    mainTf += `
# Kubernetes Orchestration (AWS EKS)
resource "aws_iam_role" "eks_cluster" {
  name = "\${var.project_name}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_eks_cluster" "eks" {
  name     = "\${var.project_name}-cluster"
  role_arn = aws_iam_role.eks_cluster.arn

  vpc_config {
    subnet_ids = aws_subnet.private[*].id
  }

  depends_on = [aws_iam_role_policy_attachment.eks_cluster]
}

resource "aws_iam_role" "eks_nodes" {
  name = "\${var.project_name}-eks-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_node_worker" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "eks_node_cni" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "eks_node_registry" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_eks_node_group" "nodes" {
  cluster_name    = aws_eks_cluster.eks.name
  node_group_name = "general-compute"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = aws_subnet.private[*].id

  scaling_config {
    desired_size = 2
    max_size     = 5
    min_size     = 1
  }

  instance_types = ["t3.medium"]

  depends_on = [
    aws_iam_role_policy_attachment.eks_node_worker,
    aws_iam_role_policy_attachment.eks_node_cni,
    aws_iam_role_policy_attachment.eks_node_registry
  ]
}
`;
  } else {
    // Single server architecture
    mainTf += `
# Core Server Compute (EC2)
resource "aws_security_group" "web" {
  name        = "\${var.project_name}-web-sg"
  description = "Allow inbound HTTP/HTTPS traffic"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "web" {
  ami           = "ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS
  instance_type = "t3.medium"
  subnet_id     = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.web.id]

  user_data = <<-EOF
              #!/bin/bash
              echo "Starting up ${project.startupName} server"
              sudo apt-get update && sudo apt-get install -y nginx docker.io
              EOF
}

resource "aws_eip" "web_ip" {
  instance = aws_instance.web.id
  domain   = "vpc"
}
`;
  }

  // AI Feature Block
  if (project.needAI) {
    mainTf += `
# AI/ML Architecture Acceleration
resource "aws_s3_bucket" "datasets" {
  bucket        = "\${var.project_name}-datasets-storage"
  force_destroy = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "datasets_encryption" {
  bucket = aws_s3_bucket.datasets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# GPU Computing Instance for deep-learning modeling
resource "aws_security_group" "ml_sg" {
  name   = "\${var.project_name}-ml-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 8888 # Jupyter
    to_port         = 8888
    protocol        = "tcp"
    security_groups = [${project.needKubernetes ? "" : "aws_security_group.web.id"}]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "ml_node" {
  ami                    = "ami-085e3478d52ca2e83" # Deep Learning Base Ubuntu
  instance_type          = "g4dn.xlarge"          # NVIDIA T4 GPU Node
  subnet_id              = aws_subnet.private[0].id
  vpc_security_group_ids = [aws_security_group.ml_sg.id]
}
`;
  }

  // Database Block
  mainTf += `
# Managed PostgreSQL Infrastructure
resource "aws_db_subnet_group" "db_subnet" {
  name       = "\${var.project_name}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_security_group" "db_sg" {
  name   = "\${var.project_name}-db-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "\${var.project_name}-database"
  allocated_storage      = ${project.storageRequirement === 'enterprise' ? 200 : project.storageRequirement === 'high' ? 100 : 20}
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = "${project.needHighAvailability ? "db.t3.medium" : "db.t3.micro"}"
  db_name                = "cloudpilot_db"
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.db_subnet.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  skip_final_snapshot    = true
  multi_az               = ${project.needHighAvailability ? "true" : "false"}
}
`;

  // Load Balancing / CDN if HA requested
  if (project.needHighAvailability) {
    mainTf += `
# Multi-AZ Load Balancer & High Availability Entryway
resource "aws_security_group" "alb" {
  name   = "\${var.project_name}-alb-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "external" {
  name               = "\${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "target_group" {
  name     = "\${var.project_name}-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/"
    protocol            = "HTTP"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.external.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.target_group.arn
  }
}
`;
  }

  const outputsTf = `output "vpc_id" {
  value       = aws_vpc.main.id
  description = "The ID of the VPC"
}

output "db_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "The connection endpoint for the PostgreSQL DB"
}

${project.needKubernetes ? `output "eks_cluster_endpoint" {
  value       = aws_eks_cluster.eks.endpoint
  description = "EKS API Cluster Endpoint Address"
}

output "eks_cluster_name" {
  value       = aws_eks_cluster.eks.name
  description = "EKS Cluster Name"
}` : `output "web_public_ip" {
  value       = aws_eip.web_ip.public_ip
  description = "Public Elastic IP assigned to the Web Server"
}`}

${project.needHighAvailability ? `output "alb_dns_name" {
  value       = aws_lb.external.dns_name
  description = "Public Application Load Balancer DNS Hostname"
}` : ''}

${project.needAI ? `output "datasets_s3_bucket" {
  value       = aws_s3_bucket.datasets.bucket
  description = "Object Storage Bucket Name for ML datasets"
}` : ''}
`;

  return {
    'providers.tf': providersTf,
    'variables.tf': variablesTf,
    'main.tf': mainTf,
    'outputs.tf': outputsTf,
  };
}

// ==========================================
// GCP TERRAFORM GENERATION
// ==========================================
function generateGCPTerraform(project: ProjectInfo, slug: string, region: string): TerraformFiles {
  const providersTf = `terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}
`;

  const variablesTf = `variable "project_name" {
  type        = string
  description = "Project name tag prefix"
  default     = "${slug}"
}

variable "environment" {
  type        = string
  default     = "production"
}

variable "gcp_project_id" {
  type        = string
  description = "The Google Cloud Platform Project ID"
  default     = "cloudpilot-prod-deploy"
}

variable "gcp_region" {
  type        = string
  description = "The primary region for resource placements"
  default     = "${region}"
}

variable "db_username" {
  type        = string
  description = "PostgreSQL DB admin username"
  default     = "cloudpilot_root"
}

variable "db_password" {
  type        = string
  description = "PostgreSQL DB admin password"
  sensitive   = true
}
`;

  let mainTf = `# Core Google Cloud VPC Custom Network
resource "google_compute_network" "vpc" {
  name                    = "\${var.project_name}-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "\${var.project_name}-subnet"
  ip_cidr_range = "10.10.0.0/20"
  region        = var.gcp_region
  network       = google_compute_network.vpc.id
}
`;

  // Compute Node Selection
  if (project.needKubernetes) {
    mainTf += `
# Kubernetes Native Orchestrator (GCP GKE Autopilot)
resource "google_container_cluster" "gke" {
  name     = "\${var.project_name}-gke-cluster"
  location = var.gcp_region

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name

  # Enable Autopilot for fully-managed provisioning, matching production best practices
  enable_autopilot = true

  ip_allocation_policy {
    use_ip_aliases = true
  }
}
`;
  } else {
    // Standalone server architecture
    mainTf += `
# Core Compute VM Instance (Compute Engine)
resource "google_compute_firewall" "allow_web" {
  name    = "\${var.project_name}-allow-web"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web-node"]
}

resource "google_compute_instance" "web_server" {
  name         = "\${var.project_name}-web"
  machine_type = "e2-medium"
  zone         = "\${var.gcp_region}-a"

  tags = ["web-node"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 30
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.subnet.id
    access_config {
      // Dynamic Ephemeral Public IP
    }
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    sudo apt-get update
    sudo apt-get install -y nginx docker.io
  EOF
}
`;
  }

  // AI Feature Block
  if (project.needAI) {
    mainTf += `
# Object Storage (GCS Bucket) for datasets and storage models
resource "google_storage_bucket" "datasets" {
  name                        = "\${var.project_name}-ai-datasets"
  location                    = var.gcp_region
  force_destroy               = true
  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

# Vertex AI Custom Pipeline Service Notebook Instance
resource "google_compute_instance" "gpu_ai_node" {
  name         = "\${var.project_name}-gpu-acceleration"
  machine_type = "n1-standard-4" # Required instance type for GPU support
  zone         = "\${var.gcp_region}-a"

  boot_disk {
    initialize_params {
      image = "deeplearning-platform-release/pytorch-latest-gpu-v20230615"
      size  = 100
    }
  }

  guest_accelerator {
    type  = "nvidia-tesla-t4"
    count = 1
  }

  network_interface {
    subnetwork = google_compute_subnetwork.subnet.id
    access_config {
      # Ephemeral public IP to fetch CUDA files
    }
  }

  scheduling {
    on_host_maintenance = "TERMINATE" # GPUs don't support live migration
  }
}
`;
  }

  // Database Block
  mainTf += `
# Managed SQL Database System (Cloud SQL)
resource "google_compute_global_address" "private_ip_alloc" {
  name          = "\${var.project_name}-private-ip-alloc"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_alloc.name]
}

resource "google_sql_database_instance" "postgres" {
  name             = "\${var.project_name}-postgres"
  region           = var.gcp_region
  database_version = "POSTGRES_15"
  depends_on       = [google_service_networking_connection.private_vpc_connection]

  settings {
    tier = "${project.needHighAvailability ? "db-custom-2-7680" : "db-f1-micro"}"
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }

    # High availability multi-zone failover configuration
    availability_type = "${project.needHighAvailability ? "REGIONAL" : "ZONAL"}"

    disk_size = ${project.storageRequirement === 'enterprise' ? 250 : project.storageRequirement === 'high' ? 100 : 20}
    disk_type = "PD_SSD"
  }
}

resource "google_sql_user" "users" {
  name     = var.db_username
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}
`;

  // Load Balancing / HA Entryway
  if (project.needHighAvailability) {
    mainTf += `
# Multi-Regional HTTP Load Balancing Architecture
resource "google_compute_global_forwarding_rule" "default" {
  name       = "\${var.project_name}-lb"
  target     = google_compute_target_http_proxy.default.id
  port_range = "80"
}

resource "google_compute_target_http_proxy" "default" {
  name    = "\${var.project_name}-target-proxy"
  url_map = google_compute_url_map.default.id
}

resource "google_compute_url_map" "default" {
  name            = "\${var.project_name}-url-map"
  default_service = google_compute_backend_service.default.id
}

resource "google_compute_backend_service" "default" {
  name        = "\${var.project_name}-backend-service"
  port_name   = "http"
  protocol    = "HTTP"
  timeout_sec = 10

  health_checks = [google_compute_health_check.default.id]
}

resource "google_compute_health_check" "default" {
  name               = "\${var.project_name}-health-check"
  check_interval_sec = 5
  timeout_sec        = 5

  http_health_check {
    port = 80
  }
}
`;
  }

  const outputsTf = `output "network_id" {
  value       = google_compute_network.vpc.id
  description = "The ID of the custom VPC network"
}

output "db_connection_name" {
  value       = google_sql_database_instance.postgres.connection_name
  description = "Cloud SQL Database instance connection identifier string"
}

${project.needKubernetes ? `output "gke_cluster_endpoint" {
  value       = google_container_cluster.gke.endpoint
  description = "The API Endpoint for the GKE Autopilot Cluster"
}` : `output "web_public_ip" {
  value       = google_compute_instance.web_server.network_interface[0].access_config[0].nat_ip
  description = "Compute VM Server external static IP address"
}`}

${project.needHighAvailability ? `output "global_lb_ip" {
  value       = google_compute_global_forwarding_rule.default.ip_address
  description = "The external global static IP address of the HTTP load balancer"
}` : ''}

${project.needAI ? `output "datasets_gcs_bucket" {
  value       = google_storage_bucket.datasets.name
  description = "GCS Object Storage bucket name"
}` : ''}
`;

  return {
    'providers.tf': providersTf,
    'variables.tf': variablesTf,
    'main.tf': mainTf,
    'outputs.tf': outputsTf,
  };
}

// ==========================================
// AZURE TERRAFORM GENERATION
// ==========================================
function generateAzureTerraform(project: ProjectInfo, slug: string, region: string): TerraformFiles {
  const providersTf = `terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}
`;

  const variablesTf = `variable "project_name" {
  type        = string
  description = "Primary resource prefix"
  default     = "${slug}"
}

variable "environment" {
  type        = string
  default     = "production"
}

variable "azure_location" {
  type        = string
  description = "The geographical Azure data center region"
  default     = "${region}"
}

variable "db_username" {
  type        = string
  default     = "cloudpilot_admin"
}

variable "db_password" {
  type        = string
  description = "Administrator password for the PostgreSQL Database flex server"
  sensitive   = true
}
`;

  let mainTf = `# Core Resource Group & Virtual Network
resource "azurerm_resource_group" "rg" {
  name     = "\${var.project_name}-rg"
  location = var.azure_location
}

resource "azurerm_virtual_network" "vnet" {
  name                = "\${var.project_name}-vnet"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  address_space       = ["10.0.0.0/16"]
}

resource "azurerm_subnet" "public" {
  name                 = "public-subnet"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.1.0/24"]
}

resource "azurerm_subnet" "private" {
  name                 = "private-subnet"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.2.0/24"]
  
  delegation {
    name = "postgresql-delegation"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}
`;

  // Compute Node Architecture
  if (project.needKubernetes) {
    mainTf += `
# Azure Kubernetes Service (AKS Cluster)
resource "azurerm_kubernetes_cluster" "aks" {
  name                = "\${var.project_name}-aks"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  dns_prefix          = "\${var.project_name}-k8s"

  default_node_pool {
    name       = "default"
    node_count = 2
    vm_size    = "Standard_D2s_v5"
  }

  identity {
    type = "SystemAssigned"
  }
}
`;
  } else {
    mainTf += `
# Standalone Virtual Machine Node (Ubuntu Server)
resource "azurerm_public_ip" "web_ip" {
  name                = "\${var.project_name}-public-ip"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard"
}

resource "azurerm_network_interface" "web_nic" {
  name                = "\${var.project_name}-nic"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.public.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.web_ip.id
  }
}

resource "azurerm_network_security_group" "web_nsg" {
  name                = "\${var.project_name}-nsg"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "HTTP"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "HTTPS"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_interface_security_group_association" "nsg_assoc" {
  network_interface_id      = azurerm_network_interface.web_nic.id
  network_security_group_id = azurerm_network_security_group.web_nsg.id
}

resource "azurerm_linux_virtual_machine" "web_vm" {
  name                = "\${var.project_name}-vm"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  size                = "Standard_B2s"
  admin_username      = "azureuser"
  network_interface_ids = [
    azurerm_network_interface.web_nic.id,
  ]

  admin_ssh_key {
    username   = "azureuser"
    public_key = file("~/.ssh/id_rsa.pub")
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts"
    version   = "latest"
  }

  user_data = base64encode(<<-EOF
              #!/bin/bash
              sudo apt-get update
              sudo apt-get install -y nginx docker.io
              EOF
  )
}
`;
  }

  // AI Feature Block
  if (project.needAI) {
    mainTf += `
# Azure Blob Storage Account for modeling datasets
resource "azurerm_storage_account" "storage" {
  name                     = replace("\${var.project_name}store", "-", "")
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_storage_container" "datasets" {
  name                  = "datasets"
  storage_account_name  = azurerm_storage_account.storage.name
  container_access_type = "private"
}

# Machine Learning Workspace Studio Configuration
resource "azurerm_application_insights" "app_ins" {
  name                = "\${var.project_name}-insights"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  application_type    = "web"
}

resource "azurerm_key_vault" "vault" {
  name                = replace("\${var.project_name}-kv", "-", "")
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tenant_id           = "00000000-0000-0000-0000-000000000000" # Dummy Tenant placeholder
  sku_name            = "standard"
}

resource "azurerm_machine_learning_workspace" "ml_studio" {
  name                    = "\${var.project_name}-ml-workspace"
  location                = azurerm_resource_group.rg.location
  resource_group_name     = azurerm_resource_group.rg.name
  application_insights_id = azurerm_application_insights.app_ins.id
  key_vault_id            = azurerm_key_vault.vault.id
  storage_account_id      = azurerm_storage_account.storage.id

  identity {
    type = "SystemAssigned"
  }
}
`;
  }

  // Database Block
  mainTf += `
# Azure Database for PostgreSQL Flexible Server
resource "azurerm_private_dns_zone" "dns_zone" {
  name                = "\${var.project_name}-private-dns.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_private_dns_zone_virtual_network_link" "vnet_link" {
  name                  = "dns-vnet-link"
  resource_group_name   = azurerm_resource_group.rg.name
  private_dns_zone_name = azurerm_private_dns_zone.dns_zone.name
  virtual_network_id    = azurerm_virtual_network.vnet.id
}

resource "azurerm_postgresql_flexible_server" "postgres" {
  name                   = "\${var.project_name}-postgresql"
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = "14"
  delegated_subnet_id    = azurerm_subnet.private.id
  private_dns_zone_id    = azurerm_private_dns_zone.dns_zone.id
  administrator_login    = var.db_username
  administrator_password = var.db_password
  storage_mb             = ${project.storageRequirement === 'enterprise' ? 262144 : project.storageRequirement === 'high' ? 102400 : 32768}
  sku_name               = "${project.needHighAvailability ? "GP_Standard_D2s_v3" : "B_Standard_B1ms"}"
  
  # Zone-redundant high availability pairing
  ${project.needHighAvailability ? `high_availability {
    mode = "ZoneRedundant"
  }` : ''}

  depends_on = [azurerm_private_dns_zone_virtual_network_link.vnet_link]
}
`;

  // High Availability Application Gateway
  if (project.needHighAvailability) {
    mainTf += `
# Application Gateway High Availability Entry Load Balancer
resource "azurerm_public_ip" "app_gateway_ip" {
  name                = "\${var.project_name}-gw-ip"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  allocation_method   = "Static"
  sku                 = "Standard"
}

resource "azurerm_subnet" "gateway_subnet" {
  name                 = "gateway-subnet"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.3.0/24"]
}

resource "azurerm_application_gateway" "network_gateway" {
  name                = "\${var.project_name}-appgateway"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location

  sku {
    name     = "Standard_v2"
    tier     = "Standard_v2"
    capacity = 2
  }

  gateway_ip_configuration {
    name      = "my-gateway-ip-configuration"
    subnet_id = azurerm_subnet.gateway_subnet.id
  }

  frontend_port {
    name = "frontend-port"
    port = 80
  }

  frontend_ip_configuration {
    name                 = "frontend-ip-config"
    public_ip_address_id = azurerm_public_ip.app_gateway_ip.id
  }

  backend_address_pool {
    name = "backend-pool"
  }

  backend_http_settings {
    name                  = "http-settings"
    cookie_based_affinity = "Disabled"
    port                  = 80
    protocol              = "Http"
    request_timeout       = 60
  }

  http_listener {
    name                           = "http-listener"
    frontend_ip_configuration_name = "frontend-ip-config"
    frontend_port_name             = "frontend-port"
    protocol                       = "Http"
  }

  request_routing_rule {
    name                        = "routing-rule"
    rule_type                   = "Basic"
    http_listener_name          = "http-listener"
    backend_address_pool_name   = "backend-pool"
    backend_http_settings_name  = "http-settings"
    priority                    = 1
  }
}
`;
  }

  const outputsTf = `output "resource_group_name" {
  value       = azurerm_resource_group.rg.name
  description = "The Azure Resource Group holding all cloud resources"
}

output "postgres_fqdn" {
  value       = azurerm_postgresql_flexible_server.postgres.fqdn
  description = "The fully qualified domain name of the PostgreSQL server"
}

${project.needKubernetes ? `output "aks_api_server" {
  value       = azurerm_kubernetes_cluster.aks.fqdn
  description = "AKS Master API Server Hostname Address"
}` : `output "vm_public_ip" {
  value       = azurerm_public_ip.web_ip.ip_address
  description = "Public static IP assigned to the Linux Web VM"
}`}

${project.needHighAvailability ? `output "application_gateway_ip" {
  value       = azurerm_public_ip.app_gateway_ip.ip_address
  description = "Static Public IP assigned to Application Gateway Load Balancer"
}` : ''}

${project.needAI ? `output "datasets_storage_account_name" {
  value       = azurerm_storage_account.storage.name
  description = "Azure Blob storage account name holding ML dataset contents"
}` : ''}
`;

  return {
    'providers.tf': providersTf,
    'variables.tf': variablesTf,
    'main.tf': mainTf,
    'outputs.tf': outputsTf,
  };
}

// ==========================================
// DIGITALOCEAN TERRAFORM GENERATION
// ==========================================
function generateDOTerraform(project: ProjectInfo, slug: string, region: string): TerraformFiles {
  const providersTf = `terraform {
  required_version = ">= 1.5.0"
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}
`;

  const variablesTf = `variable "project_name" {
  type        = string
  description = "Asset tags prefix slug"
  default     = "${slug}"
}

variable "do_region" {
  type        = string
  description = "The DigitalOcean datacenter region tag"
  default     = "${region}"
}

variable "do_token" {
  type        = string
  description = "Your DigitalOcean personal access API token"
  sensitive   = true
}
`;

  let mainTf = `# Custom isolated VPC network
resource "digitalocean_vpc" "vpc" {
  name     = "\${var.project_name}-vpc"
  region   = var.do_region
  ip_range = "10.100.0.0/16"
}
`;

  // Compute Selection
  if (project.needKubernetes) {
    mainTf += `
# Managed DigitalOcean Kubernetes Cluster (DOKS)
resource "digitalocean_kubernetes_cluster" "k8s" {
  name     = "\${var.project_name}-k8s-cluster"
  region   = var.do_region
  version  = "1.28.2-do.0"
  vpc_uuid = digitalocean_vpc.vpc.id

  node_pool {
    name       = "worker-pool"
    size       = "s-2vcpu-4gb" # Production optimal droplet size
    node_count = 2
  }
}
`;
  } else {
    mainTf += `
# Core Server Droplet Architecture (Compute Droplet)
resource "digitalocean_firewall" "web" {
  name = "\${var.project_name}-firewall"

  droplet_ids = [digitalocean_droplet.web_node.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  egress_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_droplet" "web_node" {
  name     = "\${var.project_name}-web"
  image    = "ubuntu-22-04-x64"
  size     = "s-2vcpu-4gb"
  region   = var.do_region
  vpc_uuid = digitalocean_vpc.vpc.id

  user_data = <<-EOF
              #!/bin/bash
              sudo apt-get update
              sudo apt-get install -y nginx docker.io
              EOF
}
`;
  }

  // AI Feature Block
  if (project.needAI) {
    mainTf += `
# DigitalOcean Object Spaces Storage Bucket for datasets
resource "digitalocean_spaces_bucket" "datasets" {
  name   = "\${var.project_name}-spaces-datasets"
  region = var.do_region
}

# GPU / Memory optimized Droplet for modeling execution
resource "digitalocean_droplet" "gpu_learning_node" {
  name     = "\${var.project_name}-ml-compute"
  image    = "ubuntu-22-04-x64"
  size     = "so-2vcpu-16gb" # Optimized memory footprint profile droplet
  region   = var.do_region
  vpc_uuid = digitalocean_vpc.vpc.id
}
`;
  }

  // Database Block
  mainTf += `
# Managed PostgreSQL Database Cluster
resource "digitalocean_database_cluster" "postgres" {
  name       = "\${var.project_name}-postgres"
  engine     = "pg"
  version    = "15"
  size       = "db-s-1vcpu-2gb"
  region     = var.do_region
  node_count = ${project.needHighAvailability ? 2 : 1} # Includes hot standby node replica if HA is enabled
  vpc_uuid   = digitalocean_vpc.vpc.id
}
`;

  // High Availability Load Balancer
  if (project.needHighAvailability) {
    mainTf += `
# DigitalOcean Edge Load Balancer
resource "digitalocean_loadbalancer" "public_lb" {
  name   = "\${var.project_name}-lb"
  region = var.do_region

  forwarding_rule {
    entry_port     = 80
    entry_protocol = "http"

    target_port     = 80
    target_protocol = "http"
  }

  healthcheck {
    port     = 80
    protocol = "http"
    path     = "/"
  }

  vpc_uuid = digitalocean_vpc.vpc.id
  
  # Forward traffic to computed droplethosts
  ${project.needKubernetes ? '' : `droplet_ids = [digitalocean_droplet.web_node.id]`}
}
`;
  }

  const outputsTf = `output "vpc_id" {
  value       = digitalocean_vpc.vpc.id
  description = "The ID of the custom VPC network"
}

output "database_uri" {
  value       = digitalocean_database_cluster.postgres.uri
  description = "Standard primary database connection URI"
  sensitive   = true
}

${project.needKubernetes ? `output "kubernetes_cluster_endpoint" {
  value       = digitalocean_kubernetes_cluster.k8s.endpoint
  description = "DigitalOcean Managed Kubernetes Master API Host endpoint URL"
}` : `output "droplet_ip" {
  value       = digitalocean_droplet.web_node.ipv4_address
  description = "Public IPv4 address of the computed web droplet server node"
}`}

${project.needHighAvailability ? `output "loadbalancer_ip" {
  value       = digitalocean_loadbalancer.public_lb.ip
  description = "The public external static load balancer IP address"
}` : ''}

${project.needAI ? `output "spaces_bucket_url" {
  value       = digitalocean_spaces_bucket.datasets.bucket_domain_name
  description = "Domain name address for Spaces Bucket Storage folder"
}` : ''}
`;

  return {
    'providers.tf': providersTf,
    'variables.tf': variablesTf,
    'main.tf': mainTf,
    'outputs.tf': outputsTf,
  };
}
