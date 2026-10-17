---
title: "Welcome to the blog"
description: "What this blog is about: vibe coding, building past my pay grade, and overcoming boundaries."
date: 2026-10-17
tags: [vibe-coding, pay-grade]
# A draft is visible in `npm run dev` but not on the live site.
# Set this to false (or delete the line) to publish.
draft: true
---

This is a sample post. It shows what a post looks like and how the front
matter at the top of the file works. Edit it into a real first post, or
delete the file.

## What you'll find here

Adventures in vibe coding, building past my pay grade, and overcoming boundaries: what I
tried, what broke, and what I learned.

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
