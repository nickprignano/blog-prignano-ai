---
title: "Welcome to the blog"
description: "What this blog covers and who it's for: Nerdio Manager for Enterprise, Azure Virtual Desktop, Terraform and Packer."
date: 2026-10-17
tags: [nerdio, avd, terraform, packer]
# A draft is visible in `npm run dev` but not on the live site.
# Set this to false (or delete the line) to publish.
draft: true
---

This is a sample post. It shows what a post looks like and how the front
matter at the top of the file works. Edit it into a real first post, or
delete the file.

## What you'll find here

Practical write-ups on Nerdio Manager for Enterprise, Azure Virtual Desktop,
and building images and infrastructure with Terraform and Packer.

## Code blocks

Fence code with the language name for highlighting:

```hcl
resource "azurerm_virtual_desktop_host_pool" "example" {
  name                = "hp-example"
  location            = var.location
  resource_group_name = var.resource_group_name
  type                = "Pooled"
  load_balancer_type  = "BreadthFirst"
}
```

```powershell
Get-AzWvdSessionHost -ResourceGroupName $ResourceGroup -HostPoolName $HostPool |
  Select-Object Name, Status, Sessions
```

Inline code like `terraform plan` works too.
