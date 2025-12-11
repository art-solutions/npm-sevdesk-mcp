#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance, AxiosError } from "axios";

const API_TOKEN = process.env.SEVDESK_API_TOKEN;
if (!API_TOKEN) {
    console.error("SEVDESK_API_TOKEN environment variable is required");
    process.exit(1);
}

const BASE_URL = "https://my.sevdesk.de/api/v1";

class SevDeskClient {
    private client: AxiosInstance;

    constructor(token: string) {
        this.client = axios.create({
            baseURL: BASE_URL,
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
        });
    }

    async request(method: string, url: string, data?: any, params?: any) {
        try {
            const response = await this.client.request({
                method,
                url,
                data,
                params,
            });
            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                throw new Error(
                    `SevDesk API Error: ${error.response?.status} - ${JSON.stringify(
                        error.response?.data
                    )}`
                );
            }
            throw error;
        }
    }

    async createPositions(parentId: string, parentType: "Invoice" | "Order", positions: any[]) {
        const results = [];
        const endpoint = parentType === "Invoice" ? "/InvoicePos" : "/OrderPos";
        const parentKey = parentType === "Invoice" ? "invoice" : "order";

        for (const pos of positions) {
            const payload = {
                [parentKey]: {
                    id: parentId,
                    objectName: parentType,
                },
                quantity: pos.quantity || 1,
                price: pos.price,
                name: pos.name,
                unity: {
                    id: pos.unityId || "1", // Default to 'Stück' (Piece) usually id 1
                    objectName: "Unity",
                },
                taxRate: pos.taxRate || 0,
                mapAll: true // Try to map fields automatically if possible
            };

            // Add optional text or other fields if present
            if (pos.text) (payload as any).text = pos.text;

            results.push(await this.request("POST", endpoint, payload));
        }
        return results;
    }
}

const sevdesk = new SevDeskClient(API_TOKEN);

const server = new Server(
    {
        name: "sevdesk-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "request",
                description: "Make a raw HTTP request to the SevDesk API",
                inputSchema: {
                    type: "object",
                    properties: {
                        method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
                        url: { type: "string" },
                        data: { type: "object" },
                        params: { type: "object" },
                    },
                    required: ["method", "url"],
                },
            },
            {
                name: "list_contacts",
                description: "List contacts",
                inputSchema: {
                    type: "object",
                    properties: {
                        limit: { type: "number" },
                        offset: { type: "number" },
                        customerNumber: { type: "string" },
                        depth: { type: "string" },
                    },
                },
            },
            {
                name: "create_contact",
                description: "Create a new contact",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        status: { type: "string", default: "1000" },
                        customerNumber: { type: "string" },
                        surename: { type: "string" },
                        familyname: { type: "string" },
                        categoryId: { type: "number", description: "3=Customer, 2=Supplier" },
                    },
                    required: ["name", "categoryId"],
                },
            },
            {
                name: "update_contact",
                description: "Update an existing contact",
                inputSchema: {
                    type: "object",
                    properties: {
                        contactId: { type: "string" },
                        name: { type: "string" },
                        status: { type: "string" },
                        customerNumber: { type: "string" },
                        surename: { type: "string" },
                        familyname: { type: "string" },
                    },
                    required: ["contactId"],
                },
            },
            {
                name: "list_invoices",
                description: "List invoices",
                inputSchema: {
                    type: "object",
                    properties: {
                        limit: { type: "number" },
                        offset: { type: "number" },
                        status: { type: "string" },
                        contactId: { type: "number" },
                    },
                },
            },
            {
                name: "get_invoice_positions",
                description: "Get positions for an invoice",
                inputSchema: {
                    type: "object",
                    properties: {
                        invoiceId: { type: "string" },
                        limit: { type: "number" },
                        offset: { type: "number" },
                    },
                    required: ["invoiceId"],
                },
            },
            {
                name: "create_invoice",
                description: "Create a new invoice with optional positions",
                inputSchema: {
                    type: "object",
                    properties: {
                        contactId: { type: "string" },
                        invoiceDate: { type: "string", description: "ISO date (YYYY-MM-DD)" },
                        header: { type: "string", description: "Invoice header/subject" },
                        status: { type: "string", default: "100" },
                        deliveryDate: { type: "string", description: "ISO date" },
                        positions: {
                            type: "array",
                            description: "List of line items",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    price: { type: "number" },
                                    quantity: { type: "number" },
                                    taxRate: { type: "number" },
                                    unityId: { type: "string" },
                                    text: { type: "string" },
                                },
                                required: ["name", "price"],
                            },
                        },
                        taxType: { type: "string", default: "default" },
                        currency: { type: "string", default: "EUR" },
                    },
                    required: ["contactId"],
                },
            },
            {
                name: "update_invoice",
                description: "Update an invoice",
                inputSchema: {
                    type: "object",
                    properties: {
                        invoiceId: { type: "string" },
                        status: { type: "string" },
                        header: { type: "string" },
                        deliveryDate: { type: "string" },
                    },
                    required: ["invoiceId"],
                },
            },
            {
                name: "create_offer",
                description: "Create a new offer (Order type AN)",
                inputSchema: {
                    type: "object",
                    properties: {
                        contactId: { type: "string" },
                        orderDate: { type: "string", description: "ISO date" },
                        header: { type: "string" },
                        status: { type: "string", default: "100" },
                        positions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    price: { type: "number" },
                                    quantity: { type: "number" },
                                    taxRate: { type: "number" },
                                    unityId: { type: "string" },
                                    text: { type: "string" },
                                },
                                required: ["name", "price"],
                            },
                        },
                    },
                    required: ["contactId"],
                },
            },
            {
                name: "update_offer",
                description: "Update an offer (Order)",
                inputSchema: {
                    type: "object",
                    properties: {
                        orderId: { type: "string" },
                        status: { type: "string" },
                        header: { type: "string" },
                    },
                    required: ["orderId"],
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case "request": {
                const { method, url, data, params } = args as any;
                const response = await sevdesk.request(method, url, data, params);
                return {
                    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
                };
            }

            case "list_contacts": {
                const { limit = 50, offset = 0, depth, customerNumber } = args as any;
                const params: any = { limit, offset, countAll: true };
                if (depth) params.embed = `category,parent`;
                if (customerNumber) params.customerNumber = customerNumber;
                const response = await sevdesk.request("GET", "/Contact", undefined, params);
                return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
            }

            case "create_contact": {
                const { name, status, customerNumber, surename, familyname, categoryId } = args as any;
                const payload: any = {
                    objectName: "Contact", // Fixed: Always set objectName to Contact
                    status: status || "1000",
                    category: { id: categoryId, objectName: "Category" },
                };

                // For Organization (categoryId usually != ? Actually name is used for Org, surename/familyname for Person)
                // If name is provided, use it.
                if (name) payload.name = name;
                if (surename) payload.surename = surename;
                if (familyname) payload.familyname = familyname;
                if (customerNumber) payload.customerNumber = customerNumber;

                const response = await sevdesk.request("POST", "/Contact", payload);
                return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
            }

            case "update_contact": {
                const { contactId, ...fields } = args as any;
                const payload: any = { ...fields };
                // Fixed: Do NOT remap name to objectName. Send name as name.

                const response = await sevdesk.request("PUT", `/Contact/${contactId}`, payload);
                return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
            }

            case "list_invoices": {
                const { limit = 50, offset = 0, status, contactId } = args as any;
                const params: any = { limit, offset, countAll: true };
                if (status) params.status = status;
                if (contactId) params["contact[id]"] = contactId;
                const response = await sevdesk.request("GET", "/Invoice", undefined, params);
                return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
            }

            case "get_invoice_positions": {
                const { invoiceId, limit = 50, offset = 0 } = args as any;
                const params: any = { limit, offset, "invoice[id]": invoiceId, "invoice[objectName]": "Invoice" };
                const response = await sevdesk.request("GET", "/InvoicePos", undefined, params);
                return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
            }

            case "create_invoice": {
                const { contactId, invoiceDate, header, status, deliveryDate, taxType, currency, positions } = args as any;
                const payload: any = {
                    contact: { id: contactId, objectName: "Contact" },
                    invoiceType: "RE",
                    status: status || "100",
                    invoiceDate: invoiceDate || new Date().toISOString(),
                    header: header || "Invoice",
                    currency: currency || "EUR",
                    taxType: taxType || "default",
                    mapAll: true
                };
                if (deliveryDate) payload.deliveryDate = deliveryDate;

                const invoiceResponse = await sevdesk.request("POST", "/Invoice", payload);
                const invoiceId = invoiceResponse.objects?.id || invoiceResponse.id; // Check response structure

                if (positions && positions.length > 0 && invoiceId) {
                    const posResults = await sevdesk.createPositions(invoiceId, "Invoice", positions);
                    return {
                        content: [{ type: "text", text: JSON.stringify({ invoice: invoiceResponse, positions: posResults }, null, 2) }]
                    };
                }

                return { content: [{ type: "text", text: JSON.stringify(invoiceResponse, null, 2) }] };
            }

            case "update_invoice": {
                const { invoiceId, ...fields } = args as any;
                const response = await sevdesk.request("PUT", `/Invoice/${invoiceId}`, fields);
                return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
            }

            case "create_offer": {
                const { contactId, orderDate, header, status, positions } = args as any;
                const payload: any = {
                    contact: { id: contactId, objectName: "Contact" },
                    orderType: "AN", // Offer
                    status: status || "100",
                    orderDate: orderDate || new Date().toISOString(),
                    header: header || "Offer",
                    mapAll: true
                };

                const orderResponse = await sevdesk.request("POST", "/Order", payload);
                const orderId = orderResponse.objects?.id || orderResponse.id;

                if (positions && positions.length > 0 && orderId) {
                    const posResults = await sevdesk.createPositions(orderId, "Order", positions);
                    return {
                        content: [{ type: "text", text: JSON.stringify({ offer: orderResponse, positions: posResults }, null, 2) }]
                    };
                }
                return { content: [{ type: "text", text: JSON.stringify(orderResponse, null, 2) }] };
            }

            case "update_offer": {
                const { orderId, ...fields } = args as any;
                const response = await sevdesk.request("PUT", `/Order/${orderId}`, fields);
                return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
            }

            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
    } catch (error: any) {
        const errorMsg = error.message;
        return {
            content: [{ type: "text", text: `Error: ${errorMsg}` }],
            isError: true,
        };
    }
});

const transport = new StdioServerTransport();
await server.connect(transport);
