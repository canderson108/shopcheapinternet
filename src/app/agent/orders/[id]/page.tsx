import { OrderWorkspace } from "@/components/agent/OrderWorkspace";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderWorkspace id={id} />;
}
