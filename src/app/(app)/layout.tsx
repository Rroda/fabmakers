"use client";

import FabMakersApp from "@/components/FabMakersApp";

/**
 * Layer B (D007): shell estável — navegar entre /, /client, /quote, /maker, /admin
 * não remonta o app (estado de sessão preservado).
 */
export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <FabMakersApp />
      <div className="hidden" aria-hidden="true">
        {children}
      </div>
    </>
  );
}
