# Manufacturing Max - Customer Deployment Playbook

This playbook outlines the steps for deploying and onboarding a new customer to Manufacturing Max. Follow these steps to ensure a smooth transition from pilot to production.

## 1. Provisioning

1.  **Environment Setup**
    *   Create a new instance/tenant or isolated database for the customer.
    *   Set up environment variables: `DATABASE_URL`, `JWT_SECRET`, Razorpay keys (if applicable).
    *   Run Prisma migrations: `npx prisma db push`.
2.  **Initial Admin Account**
    *   Create the first `ADMIN` user for the customer via the backend or a setup script.
3.  **License Activation**
    *   By default, the system boots into a 60-day `PILOT` mode.
    *   To set a specific plan immediately, manually insert a `Setting` record with key `LICENSE_INFO`.

## 2. Shop Floor Mapping (Admin Console)

1.  **Plants & Lines**
    *   Log in as Admin.
    *   Go to **Admin > Plants** and create the physical facilities.
    *   Go to **Admin > Production Lines** and map the lines within those plants.
2.  **Machines & Operators**
    *   Create Machines and assign them to lines. *Note: Machine limits are enforced based on the active subscription plan.*
    *   Create User accounts with the `OPERATOR` role.
3.  **Certifications (Safety Gates)**
    *   Go to **Admin > Certifications**.
    *   Issue certifications linking Operators to specific Machines. **Operators cannot clock into machines they are not certified for.**

## 3. Operations Setup

1.  **Downtime Reasons**
    *   Configure standard downtime reasons (e.g., "Setup", "No Material", "Breakdown").
2.  **Work Orders & Materials**
    *   Import or create initial Raw Materials.
    *   Create the first set of Work Orders (Jobs) to be run on the shop floor.

## 4. Hardware Deployment

1.  **Operator Terminals**
    *   Mount tablets at each machine station.
    *   Configure tablets to load the `/operator` URL in kiosk mode.
    *   Ensure the tablets are connected to the factory Wi-Fi and can reach the server.
2.  **Testing**
    *   Have a certified operator log in, clock in, start a job, log some production/scrap, and clock out.
    *   Verify the data appears in real-time on the Admin Dashboard.

## 5. Training & Handoff

1.  **Operator Training**
    *   Demonstrate the multi-lingual interface.
    *   Show how to request maintenance and log downtime.
2.  **Management Training**
    *   Show supervisors how to read the OEE dashboard and use the AI Analyst.
    *   Explain the Payroll Export feature.
3.  **Billing & Upgrades**
    *   Show the Admin the `/billing` page.
    *   Explain how to renew or upgrade the subscription when the Pilot ends.

## 6. Post-Deployment Checklist

*   [ ] All machines mapped?
*   [ ] Operators trained on tablets?
*   [ ] OEE data flowing correctly?
*   [ ] Billing contact established?
*   [ ] Support channels provided?
