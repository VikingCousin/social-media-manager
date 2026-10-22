import Link from "next/link";
import { PageHead } from "@/components/ui";
import { AccountForm } from "@/components/AccountForm";

export default function NewAccountPage() {
  return (
    <>
      <PageHead title="Account anlegen" intro="Ein neuer möglicher Kanal. Alles außer Plattform und Name darf offen bleiben.">
        <Link href="/accounts" className="btn">Abbrechen</Link>
      </PageHead>
      <AccountForm />
    </>
  );
}
