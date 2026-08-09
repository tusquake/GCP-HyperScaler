resource "google_compute_security_policy" "cloud_armor_policy" {
  name        = "ca-policy-waf-tf"
  description = "Enterprise WAF security policy blocking OWASP Top 10 vulnerabilities"

  # Rule 1: Block SQL Injection (sqli-v33-stable)
  rule {
    action   = "deny(403)"
    priority = "1000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Block SQL Injection attacks"
  }

  # Rule 2: Block Cross-Site Scripting (xss-v33-stable)
  rule {
    action   = "deny(403)"
    priority = "1001"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Block XSS attacks"
  }

  # Default Rule: Allow all other traffic
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule"
  }
}
