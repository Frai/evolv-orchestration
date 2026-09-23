export interface PurchaseOrder {
  id: string;
  locationId: string;
  approvalId: string;
  itemId: string;
  itemName: string;
  qty: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  supplier: string;
  createdAt: string;
  status: "sent";
}
