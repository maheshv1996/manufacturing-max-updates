import type { Metadata } from "next";
import RiskRegisterClient from "./RiskRegisterClient";

export const metadata: Metadata = {
  title: "Risk Register",
};

export default function RiskRegisterPage() {
  return <RiskRegisterClient />;
}