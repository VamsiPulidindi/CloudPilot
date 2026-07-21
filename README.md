# ☁️ CloudPilot

CloudPilot is a cloud infrastructure recommendation and cost evaluation platform that helps users compare cloud providers based on their application requirements. It enables users to create projects, evaluate workloads, estimate cloud infrastructure costs, and receive deployment recommendations through an interactive dashboard.

The project also demonstrates a complete DevOps workflow by integrating Infrastructure as Code (Terraform), Docker, NGINX, AWS EC2, Prometheus, Grafana, and GitHub Actions.

---

## 🚀 Features

- 🔐 User Authentication
- 📁 Project Management
- ☁️ Multi-Cloud Infrastructure Evaluation
- 💰 Cloud Cost Estimation
- 📊 Cloud Recommendation Dashboard
- 🏗 Infrastructure Blueprint Generation
- 📋 Compliance Reports
- ⚙️ Decision Matrix & Weight Configuration
- 📈 Monitoring with Prometheus
- 📊 Grafana Dashboards
- 🐳 Dockerized Application
- ☁️ AWS EC2 Deployment using Terraform

---

# 🏗️ Architecture

```text
                   User
                     │
                     ▼
                NGINX Reverse Proxy
                     │
                     ▼
             CloudPilot (Next.js)
                     │
                     ▼
        JSON Persistent Database
                     │
     ┌───────────────┴───────────────┐
     ▼                               ▼
 Prometheus                    Node Exporter
     │
     ▼
 Grafana
```

---

# 🛠 Tech Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

## Backend

- Next.js API Routes
- Node.js

## Database

- JSON-based Persistent Storage (NodeSQL Lite)

## DevOps

- Docker
- Docker Compose
- Terraform
- AWS EC2
- NGINX
- Prometheus
- Grafana
- GitHub Actions

---

# 📂 Project Structure

```text
CloudPilot/
│
├── app/
├── hooks/
├── lib/
├── monitoring/
│   ├── prometheus/
│   └── grafana/
├── nginx/
├── terraform/
│   ├── main.tf
│   ├── provider.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── userdata.sh
│   ├── terraform.tfvars
│   └── versions.tf
│
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

---

# ⚙️ Infrastructure

CloudPilot is deployed on **AWS EC2** using **Terraform**.

Terraform automatically provisions:

- Ubuntu EC2 Instance
- Security Group
- Root EBS Volume
- Docker
- Docker Compose
- Git
- CloudPilot Deployment

---

# 🐳 Docker Services

| Service | Port |
|----------|------|
| CloudPilot | 3000 |
| NGINX | 8080 *(or 80 if configured)* |
| Prometheus | 9090 |
| Grafana | 3001 |
| Node Exporter | 9100 |

---

# 📈 Monitoring

Monitoring is implemented using:

- Prometheus
- Grafana
- Node Exporter

Metrics include:

- CPU Usage
- Memory Usage
- Disk Usage
- Docker Metrics
- Application Health

---

# 🚀 Local Setup

## Clone Repository

```bash
git clone https://github.com/VamsiPulidindi/CloudPilot.git

cd CloudPilot
```

---

## Start Application

```bash
docker compose up --build
```

Application

```
http://localhost:8080
```

Prometheus

```
http://localhost:9090
```

Grafana

```
http://localhost:3001
```

Default Grafana Credentials

```
Username: admin
Password: admin123
```

---

# ☁️ Deploy using Terraform

Move into Terraform directory

```bash
cd terraform
```

Initialize Terraform

```bash
terraform init
```

Validate Configuration

```bash
terraform validate
```

Preview Infrastructure

```bash
terraform plan
```

Deploy Infrastructure

```bash
terraform apply
```

Terraform will automatically:

- Launch EC2
- Install Docker
- Clone Repository
- Build Containers
- Start CloudPilot Stack

---

# 🐳 Docker Commands

View Containers

```bash
docker ps
```

View Logs

```bash
docker logs cloudpilot
```

Restart Containers

```bash
docker compose restart
```

Rebuild Containers

```bash
docker compose up --build -d
```

Stop Containers

```bash
docker compose down
```

---

# 🌐 Access URLs

CloudPilot

```
http://<EC2-PUBLIC-IP>:8080
```

Prometheus

```
http://<EC2-PUBLIC-IP>:9090
```

Grafana

```
http://<EC2-PUBLIC-IP>:3001
```

---

# 🔄 DevOps Workflow

```text
Developer
     │
     ▼
Git Push
     │
     ▼
GitHub Repository
     │
     ▼
Terraform
     │
     ▼
AWS EC2
     │
     ▼
Docker Compose
     │
     ▼
CloudPilot
     │
     ├── NGINX
     ├── Prometheus
     ├── Grafana
     └── Node Exporter
```

---

# 🎯 Future Improvements

- PostgreSQL Database
- JWT Authentication
- Cloud Pricing API Integration
- AI-Based Cloud Recommendation
- Kubernetes Deployment
- Helm Charts
- Automated CI/CD Deployment
- HTTPS using Let's Encrypt
- Domain Name Integration
- Multi-Cloud Deployment (AWS, Azure, GCP)

---

# 📚 Learning Outcomes

This project demonstrates practical knowledge of:

- Infrastructure as Code (Terraform)
- AWS EC2
- Docker & Docker Compose
- Linux Administration
- NGINX Reverse Proxy
- Prometheus Monitoring
- Grafana Dashboards
- Git & GitHub
- CI/CD Concepts
- Cloud Infrastructure Deployment

---

# 📸 Screenshots

Add screenshots for:

- Login Page
- Dashboard
- Cloud Evaluation
- Recommendation Results
- Infrastructure Blueprint
- Docker Containers
- Prometheus Dashboard
- Grafana Dashboard
- Terraform Deployment

---

# 👨‍💻 Author

**Vamsi Pulidindi**

GitHub: https://github.com/VamsiPulidindi

---

# ⭐ Support

If you found this project helpful, please consider giving it a ⭐ on GitHub.

It helps others discover the project and motivates future improvements.

---
