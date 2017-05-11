variable "environment" {
  type        = "string"
  description = "The value that will be pre-pended to any AWS resources that are created"
  default     = "testRunner"
}

variable "useast1" {
  type        = "string"
  description = "Set if an Artillery lambda should be deployed to the us-east-1 region"
  default     = 0
}

variable "useast2" {
  type        = "string"
  description = "Set if an Artillery lambda should be deployed to the us-east-2 region"
  default     = 0
}

variable "uswest1" {
  type        = "string"
  description = "Set if an Artillery lambda should be deployed to the us-west-1 region"
  default     = 0
}

variable "uswest2" {
  type        = "string"
  description = "Set if an Artillery lambda should be deployed to the us-west-2 region"
  default     = 0
}

variable "env_vars" {
  type        = "map"
  description = "Environmental variables to be set on the Artillery lambdas"

  default = {
    None = "true"
  }
}
