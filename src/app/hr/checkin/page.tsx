import { redirect } from "next/navigation";

// The check-in kiosk now lives in the admin area (cashier machine is the main
// device). This standalone /hr PWA entry just forwards to it.
export default function HrCheckinRedirect() {
  redirect("/admin/employee-checkin");
}
