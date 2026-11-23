from dataclasses import dataclass
from typing import List


@dataclass
class LineItem:
    description: str
    quantity: int
    unit_cents: int


@dataclass
class Invoice:
    customer_id: str
    items: List[LineItem]
    tax_rate: float = 0.13


def compute_subtotal_cents(invoice: Invoice) -> int:
    """Sum line items before tax."""
    return sum(item.quantity * item.unit_cents for item in invoice.items)


def compute_tax_cents(invoice: Invoice) -> int:
    """Apply tax_rate to the subtotal."""
    subtotal = compute_subtotal_cents(invoice)
    return int(round(subtotal * invoice.tax_rate))


def compute_total_cents(invoice: Invoice) -> int:
    """Grand total including tax."""
    return compute_subtotal_cents(invoice) + compute_tax_cents(invoice)


def format_invoice_summary(invoice: Invoice) -> str:
    total = compute_total_cents(invoice)
    return f"customer={invoice.customer_id} total_cents={total}"
