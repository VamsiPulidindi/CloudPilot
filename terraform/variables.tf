variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "ap-south-1"
}

variable "instance_type" {
  description = "EC2 Instance Type"
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Existing EC2 Key Pair"
  type        = string
  default     = "ubuntu-key"
}

variable "project_name" {
  description = "Project Name"
  type        = string
  default     = "CloudPilot"
}

variable "allowed_ssh_cidr" {
  description = "CIDR allowed to SSH into EC2"
  type        = string
  default     = "0.0.0.0/0"
}

variable "github_repo" {
  description = "GitHub repository"
  type        = string
  default     = "https://github.com/VamsiPulidindi/cloudpilot.git"
}

