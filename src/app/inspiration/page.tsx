import { redirect } from "next/navigation";

// Die frühere Inspirations-Sammlung ist im Content-Radar aufgegangen.
export default function InspirationRedirect() {
  redirect("/radar");
}
