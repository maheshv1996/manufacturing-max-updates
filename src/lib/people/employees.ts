import { err, ok, type Result } from "../core/result";

export type ValidateEmployeeInput = {
  employeeNumber: string;
  name: string;
  designation?: string;
  department?: string;
  panNumber?: string;
  aadhaarNumber?: string;
  pfUan?: string;
  esiNumber?: string;
};

export type ValidationError = {
  field: string;
  message: string;
};

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_RE = /^\d{12}$/;
const UAN_RE = /^\d{12}$/;
const ESI_RE = /^\d{17}$/;

export function validateEmployee(input: ValidateEmployeeInput): Result<void, ValidationError[]> {
  const errors: ValidationError[] = [];

  if (!input.employeeNumber || input.employeeNumber.trim().length === 0) {
    errors.push({ field: "employeeNumber", message: "employeeNumber is required" });
  }
  if (!input.name || input.name.trim().length === 0) {
    errors.push({ field: "name", message: "name is required" });
  }
  if (input.panNumber && !PAN_RE.test(input.panNumber)) {
    errors.push({ field: "panNumber", message: "PAN must be 10 chars (5 letters + 4 digits + 1 letter)" });
  }
  if (input.aadhaarNumber && !AADHAAR_RE.test(input.aadhaarNumber)) {
    errors.push({ field: "aadhaarNumber", message: "Aadhaar must be 12 digits" });
  }
  if (input.pfUan && !UAN_RE.test(input.pfUan)) {
    errors.push({ field: "pfUan", message: "PF UAN must be 12 digits" });
  }
  if (input.esiNumber && !ESI_RE.test(input.esiNumber)) {
    errors.push({ field: "esiNumber", message: "ESI number must be 17 digits" });
  }

  if (errors.length > 0) return err(errors);
  return ok(undefined);
}
