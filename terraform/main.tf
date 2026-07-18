data "aws_ami" "ubuntu" {

  most_recent = true

  owners = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_security_group" "cloudpilot_sg" {

  name_prefix = "cloudpilot-"

  description = "CloudPilot Security Group"

  ingress {
    description = "SSH"

    from_port = 22
    to_port   = 22
    protocol  = "tcp"

    cidr_blocks = [var.allowed_ssh_cidr]
  }

  ingress {
    description = "HTTP"

    from_port = 80
    to_port   = 80
    protocol  = "tcp"

    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Grafana"

    from_port = 3001
    to_port   = 3001
    protocol  = "tcp"

    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Prometheus"

    from_port = 9090
    to_port   = 9090
    protocol  = "tcp"

    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {

    from_port = 0
    to_port   = 0
    protocol  = "-1"

    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-SG"
    Project     = var.project_name
    Environment = "Dev"
    ManagedBy   = "Terraform"
  }
}

resource "aws_instance" "cloudpilot" {

  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type

  key_name = var.key_name

  vpc_security_group_ids = [
    aws_security_group.cloudpilot_sg.id
  ]

  user_data = templatefile("${path.module}/userdata.sh", {
    github_repo = var.github_repo
  })

  root_block_device {
    volume_size           = 20
    volume_type           = "gp3"
    delete_on_termination = true
  }

  tags = {
    Name        = var.project_name
    Project     = var.project_name
    Environment = "Dev"
    ManagedBy   = "Terraform"
  }
}
