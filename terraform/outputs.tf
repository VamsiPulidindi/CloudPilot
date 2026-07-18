output "instance_id" {
  value = aws_instance.cloudpilot.id
}

output "public_ip" {
  value = aws_instance.cloudpilot.public_ip
}

output "public_dns" {
  value = aws_instance.cloudpilot.public_dns
}

output "ssh_command" {
  value = "ssh -i ubuntu-key.pem ubuntu@${aws_instance.cloudpilot.public_ip}"
}

output "application_url" {
  value = "http://${aws_instance.cloudpilot.public_ip}"
}

output "grafana_url" {
  value = "http://${aws_instance.cloudpilot.public_ip}:3001"
}

output "prometheus_url" {
  value = "http://${aws_instance.cloudpilot.public_ip}:9090"
}
