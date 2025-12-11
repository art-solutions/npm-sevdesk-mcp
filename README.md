# sevdesk-mcp

A Model Context Protocol (MCP) server for the [SevDesk](https://sevdesk.de) API. This package allows AI agents (like Claude) to interact with your SevDesk account to manage contacts, invoices, offers, and more.

## Installation

You can use this MCP server directly via `npx` without installing it globally:

```bash
npx sevdesk-mcp
```

Or install it globally:

```bash
npm install -g sevdesk-mcp
```

## Configuration

The server requires the `SEVDESK_API_TOKEN` environment variable to be set.

You can find your API token in your SevDesk account settings under **Settings > Users > [Your User] > API Token**.

## Usage with Claude Desktop

Add the following to your Claude Desktop configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sevdesk": {
      "command": "npx",
      "args": ["-y", "npm-sevdesk-mcp"],
      "env": {
        "SEVDESK_API_TOKEN": "YOUR_API_TOKEN_HERE"
      }
    }
  }
}
```

### Configuration File Locations

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

## Usage with Cursor

1. Open **Cursor Settings**.
2. Navigate to **Features > MCP**.
3. Click **Add New MCP Server**.
4. Enter the following details:
   - **Name**: `sevdesk`
   - **Type**: `command`
   - **Command**: `npx -y npm-sevdesk-mcp`
   - **Environment Variables**: Add a new variable with Key `SEVDESK_API_TOKEN` and your token as the Value.

## Usage with ChatGPT Desktop

1. Open the **ChatGPT Desktop** application (macOS/Windows).
2. Go to **Settings**.
3. Enable **Developer Mode** (if required) or look for **Connectors** / **MCP Servers**.
4. Add a new server with the following configuration:
   - **Name**: `sevdesk`
   - **Command**: `npx -y npm-sevdesk-mcp`
   - **Environment Variables**: `SEVDESK_API_TOKEN=YOUR_API_TOKEN`

## Available Tools

### Generic
- **`request`**: Make a raw HTTP request to any SevDesk API endpoint.
  - *Inputs*: `method` (GET/POST/PUT/DELETE), `url`, `data` (body), `params` (query).

### Contacts
- **`list_contacts`**: List contacts with optional filtering.
  - *Inputs*: `limit`, `offset`, `customerNumber`, `depth`.
- **`create_contact`**: Create a new contact (Organization or Person).
  - *Inputs*: `name` (Organization Name), `categoryId` (3=Customer, 2=Supplier), `surename`/`familyname` (for Persons), `customerNumber`.
- **`update_contact`**: Update an existing contact.
  - *Inputs*: `contactId` (Required), and any fields to update (e.g., `name`, `status`).

### Invoices
- **`list_invoices`**: List invoices.
  - *Inputs*: `limit`, `offset`, `status`, `contactId`.
- **`create_invoice`**: Create a new invoice, optionally including line items (positions).
  - *Inputs*: `contactId` (Required), `header`, `invoiceDate`, `deliveryDate`, `status`, `positions` (Array of items).
- **`update_invoice`**: Update an existing invoice.
  - *Inputs*: `invoiceId` (Required), `header`, `status`, `deliveryDate`.
- **`get_invoice_positions`**: Get the line items for a specific invoice.
  - *Inputs*: `invoiceId` (Required).

### Offers (Orders)
- **`create_offer`**: Create a new offer (Order type 'AN'), optionally including line items.
  - *Inputs*: `contactId` (Required), `header`, `orderDate`, `status`, `positions` (Array of items).
- **`update_offer`**: Update an existing offer.
  - *Inputs*: `orderId` (Required), `header`, `status`.

## Example Usage

Once configured, you can ask Claude to:

- "List all my contacts in SevDesk"
- "Create a new customer contact named 'Acme Corp'"
- "Show me all unpaid invoices"
- "Create an invoice for contact ID 12345 with two line items"

## Requirements

- Node.js >= 16.0.0
- A SevDesk account with API access

## Troubleshooting

- **Authentication Errors**: Ensure your `SEVDESK_API_TOKEN` is correct and has permissions to access the API.
- **Model/Field Errors**: The SevDesk API structure can be complex. If a specific field isn't working with the convenience tools, try using the raw `request` tool to debug or perform the action manually.

## License

MIT
