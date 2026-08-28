import { prisma } from '../src/lib/prisma';

const WORKSPACE_PERMISSIONS = {
  ops: { view: "ops.view", edit: "ops.edit" },
  supply: { view: "supply.view", edit: "supply.edit" },
  commercial: { view: "commercial.view", edit: "commercial.edit" },
  people: { view: "people.view", edit: "people.edit" },
  system: { view: "system.view", edit: "system.edit" },
};

const SPECIAL_PERMISSIONS = {
  USERS_MANAGE: "users.manage",
  TERMINAL_USE: "terminal.use",
  REPORTS_PRINT: "reports.print",
  RECORDS_EDIT: "records.edit",
  KPI_OVERRIDE: "kpi.override",
  AUDIT_VIEW: "audit.view",
};

const ALL_PERMISSIONS = [
  ...Object.values(WORKSPACE_PERMISSIONS).flatMap((ws) => [ws.view, ws.edit]),
  ...Object.values(SPECIAL_PERMISSIONS),
];

async function main() {
  console.log("Seeding Roles...");

  const adminRole = await prisma.role.upsert({
    where: { name: "Administrator" },
    update: { permissions: ALL_PERMISSIONS, isSystem: true },
    create: { name: "Administrator", permissions: ALL_PERMISSIONS, isSystem: true, description: "Full system access" },
  });

  await prisma.role.upsert({
    where: { name: "Production Head" },
    update: { 
      permissions: [WORKSPACE_PERMISSIONS.ops.view, WORKSPACE_PERMISSIONS.ops.edit, WORKSPACE_PERMISSIONS.people.view, SPECIAL_PERMISSIONS.USERS_MANAGE, SPECIAL_PERMISSIONS.RECORDS_EDIT, SPECIAL_PERMISSIONS.REPORTS_PRINT],
      isSystem: true 
    },
    create: { 
      name: "Production Head", 
      permissions: [WORKSPACE_PERMISSIONS.ops.view, WORKSPACE_PERMISSIONS.ops.edit, WORKSPACE_PERMISSIONS.people.view, SPECIAL_PERMISSIONS.USERS_MANAGE, SPECIAL_PERMISSIONS.RECORDS_EDIT, SPECIAL_PERMISSIONS.REPORTS_PRINT],
      isSystem: true,
      description: "Manage operations and operators"
    },
  });

  await prisma.role.upsert({
    where: { name: "Store Head" },
    update: { permissions: [WORKSPACE_PERMISSIONS.supply.view, WORKSPACE_PERMISSIONS.supply.edit, SPECIAL_PERMISSIONS.USERS_MANAGE, SPECIAL_PERMISSIONS.REPORTS_PRINT], isSystem: true },
    create: { name: "Store Head", permissions: [WORKSPACE_PERMISSIONS.supply.view, WORKSPACE_PERMISSIONS.supply.edit, SPECIAL_PERMISSIONS.USERS_MANAGE, SPECIAL_PERMISSIONS.REPORTS_PRINT], isSystem: true },
  });

  await prisma.role.upsert({
    where: { name: "Sales Head" },
    update: { permissions: [WORKSPACE_PERMISSIONS.commercial.view, WORKSPACE_PERMISSIONS.commercial.edit, SPECIAL_PERMISSIONS.USERS_MANAGE, SPECIAL_PERMISSIONS.REPORTS_PRINT], isSystem: true },
    create: { name: "Sales Head", permissions: [WORKSPACE_PERMISSIONS.commercial.view, WORKSPACE_PERMISSIONS.commercial.edit, SPECIAL_PERMISSIONS.USERS_MANAGE, SPECIAL_PERMISSIONS.REPORTS_PRINT], isSystem: true },
  });

  await prisma.role.upsert({
    where: { name: "HR Head" },
    update: { permissions: [WORKSPACE_PERMISSIONS.people.view, WORKSPACE_PERMISSIONS.people.edit, SPECIAL_PERMISSIONS.USERS_MANAGE, SPECIAL_PERMISSIONS.REPORTS_PRINT], isSystem: true },
    create: { name: "HR Head", permissions: [WORKSPACE_PERMISSIONS.people.view, WORKSPACE_PERMISSIONS.people.edit, SPECIAL_PERMISSIONS.USERS_MANAGE, SPECIAL_PERMISSIONS.REPORTS_PRINT], isSystem: true },
  });

  await prisma.role.upsert({
    where: { name: "Production Supervisor" },
    update: { permissions: [WORKSPACE_PERMISSIONS.ops.view, WORKSPACE_PERMISSIONS.ops.edit, WORKSPACE_PERMISSIONS.people.view, SPECIAL_PERMISSIONS.TERMINAL_USE, SPECIAL_PERMISSIONS.REPORTS_PRINT], isSystem: true },
    create: { name: "Production Supervisor", permissions: [WORKSPACE_PERMISSIONS.ops.view, WORKSPACE_PERMISSIONS.ops.edit, WORKSPACE_PERMISSIONS.people.view, SPECIAL_PERMISSIONS.TERMINAL_USE, SPECIAL_PERMISSIONS.REPORTS_PRINT], isSystem: true },
  });

  const operatorRole = await prisma.role.upsert({
    where: { name: "Operator" },
    update: { permissions: [SPECIAL_PERMISSIONS.TERMINAL_USE], isSystem: true },
    create: { name: "Operator", permissions: [SPECIAL_PERMISSIONS.TERMINAL_USE], isSystem: true },
  });

  await prisma.role.upsert({
    where: { name: "Accounts Viewer" },
    update: { permissions: [WORKSPACE_PERMISSIONS.commercial.view, SPECIAL_PERMISSIONS.REPORTS_PRINT], isSystem: true },
    create: { name: "Accounts Viewer", permissions: [WORKSPACE_PERMISSIONS.commercial.view, SPECIAL_PERMISSIONS.REPORTS_PRINT], isSystem: true },
  });

  console.log("Roles seeded.");

  // Map users. Since we can't rely on `role` enum anymore (it will be dropped), 
  // we will just assign Administrator to username 'admin' and set isOwner = true.
  // We'll give Operator to all other users that have no roleId.
  await prisma.user.updateMany({
    where: { username: 'admin' },
    data: { roleId: adminRole.id, isOwner: true }
  });

  const otherUsers = await prisma.user.findMany({
    where: { roleId: null }
  });

  for (const user of otherUsers) {
      await prisma.user.update({
          where: { id: user.id },
          data: { roleId: operatorRole.id }
      });
  }
  
  console.log("User roles updated.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
