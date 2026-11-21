
import prisma from "../../config/database.js";
import { createAuditLog } from "../audits/audit.service.js";
import { Prisma } from "@prisma/client";
function normalizeCustomerData(data) {
  const normalized = { ...data };

  if (typeof normalized.email === "string") {
    normalized.email = normalized.email.trim() || null;
  }

  if (typeof normalized.phone === "string") {
    normalized.phone = normalized.phone.trim();
  }

  if (typeof normalized.name === "string") {
    normalized.name = normalized.name.trim();
  }

  return normalized;
}

function handleDuplicatePhone(error) {
  if (error.code === "P2002") {
    const duplicateError = new Error(
      "A customer with this phone number already exists."
    );
    duplicateError.statusCode = 409;
    throw duplicateError;
  }

  throw error;
}

function customerNotFound() {
  const error = new Error("Customer not found.");
  error.statusCode = 404;
  return error;
}

// CREATE CUSTOMER
export async function createCustomer(restaurantId, userId, data) {
  const customerData = normalizeCustomerData(data);

  try {
    return await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          restaurantId,
          ...customerData,
        },
      });

      await createAuditLog({
        tx,
        restaurantId,
        userId,
        action: "CUSTOMER_CREATED",
        resource: "CUSTOMER",
        resourceId: customer.id,
        description: `Created customer ${customer.name}.`,
        metadata: {
          customerName: customer.name,
          phone: customer.phone,
          hasEmail: Boolean(customer.email),
        },
      });

      return customer;
    });
  } catch (error) {
    handleDuplicatePhone(error);
  }
}

// LIST CUSTOMERS
export async function listCustomers(restaurantId, filters) {
  const { page, limit, search, isActive } = filters;

  const where = {
    restaurantId,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (isActive !== undefined) {
    where.isActive = isActive === "true";
  }

  const [customers, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        loyaltyAccount: {
          select: {
            pointsBalance: true,
            isActive: true,
          },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// GET SINGLE CUSTOMER
export async function getCustomerById(restaurantId, customerId) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      restaurantId,
    },
    include: {
      loyaltyAccount: {
        select: {
          pointsBalance: true,
          isActive: true,
        },
      },
    },
  });

  if (!customer) {
    throw customerNotFound();
  }

  return customer;
}

// UPDATE CUSTOMER
export async function updateCustomer(
  restaurantId,
  userId,
  customerId,
  data
) {
  const customerData = normalizeCustomerData(data);

  try {
    return await prisma.$transaction(async (tx) => {
      const existingCustomer = await tx.customer.findFirst({
        where: {
          id: customerId,
          restaurantId,
        },
      });

      if (!existingCustomer) {
        throw customerNotFound();
      }

      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: customerData,
      });

      const changedFields = Object.keys(customerData);
      const action = Object.hasOwn(customerData, "isActive")
        ? customerData.isActive
          ? "CUSTOMER_ACTIVATED"
          : "CUSTOMER_DEACTIVATED"
        : "CUSTOMER_UPDATED";

      await createAuditLog({
        tx,
        restaurantId,
        userId,
        action,
        resource: "CUSTOMER",
        resourceId: customerId,
        description: `Updated customer ${updatedCustomer.name}.`,
        metadata: {
          changedFields,
          previousIsActive: existingCustomer.isActive,
          newIsActive: updatedCustomer.isActive,
        },
      });

      return updatedCustomer;
    });
  } catch (error) {
    handleDuplicatePhone(error);
  }
}


const CREDIT_MANAGEMENT_ROLES = ["OWNER", "ADMIN", "MANAGER"];

export async function updateCustomerCredit(
  restaurantId,
  userId,
  userRole,
  customerId,
  data
) {
  if (!CREDIT_MANAGEMENT_ROLES.includes(userRole)) {
    const error = new Error(
      "You are not authorized to manage customer credit facilities."
    );
    error.statusCode = 403;
    throw error;
  }

  return prisma.$transaction(
    async (tx) => {
      const customer = await tx.customer.findFirst({
        where: {
          id: customerId,
          restaurantId,
        },
      });

      if (!customer) {
        throw customerNotFound();
      }

      if (!customer.isActive && data.allowCredit) {
        const error = new Error(
          "Credit cannot be enabled for an inactive customer."
        );
        error.statusCode = 400;
        throw error;
      }

      // Calculate all outstanding bills belonging to this customer.
      const outstandingResult = await tx.bill.aggregate({
        where: {
          restaurantId,
          customerId,
          status: {
            in: ["OPEN", "PARTIALLY_PAID"],
          },
        },
        _sum: {
          balance: true,
        },
      });

      const outstandingBalance =
        outstandingResult._sum.balance ?? new Prisma.Decimal(0);

      const requestedLimit = new Prisma.Decimal(data.creditLimit);

      if (requestedLimit.lessThan(outstandingBalance)) {
        const error = new Error(
          `Credit limit cannot be lower than the customer's outstanding balance of ${outstandingBalance.toFixed(2)}.`
        );
        error.statusCode = 409;
        throw error;
      }

      if (!data.allowCredit && outstandingBalance.greaterThan(0)) {
        const error = new Error(
          "Credit cannot be disabled while the customer has outstanding bills."
        );
        error.statusCode = 409;
        throw error;
      }

      const updatedCustomer = await tx.customer.update({
        where: {
          id: customerId,
        },
        data: {
          allowCredit: data.allowCredit,
          creditLimit: requestedLimit,
        },
      });

      let action = "CUSTOMER_CREDIT_LIMIT_UPDATED";

      if (!customer.allowCredit && data.allowCredit) {
        action = "CUSTOMER_CREDIT_ENABLED";
      } else if (customer.allowCredit && !data.allowCredit) {
        action = "CUSTOMER_CREDIT_DISABLED";
      }

      await createAuditLog({
        tx,
        restaurantId,
        userId,
        action,
        resource: "CUSTOMER",
        resourceId: customerId,
        description: `Updated credit facility for ${customer.name}.`,
        metadata: {
          previousAllowCredit: customer.allowCredit,
          newAllowCredit: updatedCustomer.allowCredit,
          previousCreditLimit: customer.creditLimit.toString(),
          newCreditLimit: updatedCustomer.creditLimit.toString(),
          outstandingBalance: outstandingBalance.toString(),
        },
      });

      return updatedCustomer;
    },
    {
      isolationLevel: "Serializable",
    }
  );
}
