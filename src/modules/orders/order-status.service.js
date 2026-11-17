
export async function synchronizeOrderStatus(tx, orderId) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      items: {
        select: {
          preparationStatus: true,
        },
      },
    },
  });

  if (!order || order.status === "CANCELLED") {
    return order;
  }

  const statuses = order.items.map(
    (item) => item.preparationStatus
  );

  if (statuses.length === 0) {
    return order;
  }

  let nextStatus = order.status;

  if (statuses.every((status) => status === "SERVED")) {
    nextStatus = "SERVED";
  } else if (
    statuses.every(
      (status) => status === "READY" || status === "SERVED"
    )
  ) {
    nextStatus = "READY";
  } else if (
    statuses.some((status) =>
      ["PREPARING", "READY", "SERVED"].includes(status)
    )
  ) {
    nextStatus = "PREPARING";
  }

  if (nextStatus === order.status) {
    return order;
  }

  await tx.order.update({
    where: { id: orderId },
    data: { status: nextStatus },
  });

  return {
    ...order,
    status: nextStatus,
  };
}
