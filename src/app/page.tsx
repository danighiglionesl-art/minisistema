"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FloatingWhatsApp } from "@/components/layout/FloatingWhatsApp";
import { HeroSection } from "@/components/sections/HeroSection";
import { OurDifferenceSection } from "@/components/sections/OurDifferenceSection";
import { SolutionsSection } from "@/components/sections/SolutionsSection";
import { HowWeWorkSection } from "@/components/sections/HowWeWorkSection";
import { AccompanimentSection } from "@/components/sections/AccompanimentSection";
import { CommercialModelSection } from "@/components/sections/CommercialModelSection";
import { ProjectsSection } from "@/components/sections/ProjectsSection";
import { BenefitsSection } from "@/components/sections/BenefitsSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { FinalCtaSection } from "@/components/sections/FinalCtaSection";
import { ContactSection } from "@/components/sections/ContactSection";
import { ProjectConfiguratorModal } from "@/components/configurator/ProjectConfiguratorModal";
import { FaqItem, PortfolioProject, SolutionCategory } from "@/types/minisistema";

export default function HomePage() {
  const [configuratorOpen, setConfiguratorOpen] = useState(false);
  const [preselectedCategory, setPreselectedCategory] = useState<SolutionCategory | null>(null);
  const [preselectedServiceTitle, setPreselectedServiceTitle] = useState<string | null>(null);
  const [liveProjects, setLiveProjects] = useState<PortfolioProject[] | undefined>(undefined);
  const [liveFaqs, setLiveFaqs] = useState<FaqItem[] | undefined>(undefined);

  useEffect(() => {
    fetch("/api/public/state")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.projects) setLiveProjects(data.projects);
        if (data?.faqs) setLiveFaqs(data.faqs);
      })
      .catch(() => {
        // Usa valores iniciales estáticos como respaldo
      });
  }, []);

  const handleOpenGeneralConfigurator = () => {
    setPreselectedCategory(null);
    setPreselectedServiceTitle(null);
    setConfiguratorOpen(true);
  };

  const handleOpenWithCategory = (category: SolutionCategory) => {
    setPreselectedCategory(category);
    setPreselectedServiceTitle(null);
    setConfiguratorOpen(true);
  };

  const handleOpenWithService = (serviceTitle: string) => {
    setPreselectedCategory(null);
    setPreselectedServiceTitle(serviceTitle);
    setConfiguratorOpen(true);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-petroleo)] text-[var(--color-blanco)]">
      <Header onOpenConfigurator={handleOpenGeneralConfigurator} />

      <main className="flex-1">
        {/* 7. Portada Principal — Hero */}
        <HeroSection onOpenConfigurator={handleOpenGeneralConfigurator} />

        {/* 8. Sección — Nuestra Diferencia */}
        <OurDifferenceSection />

        {/* 9. Sección — Qué Desarrollamos */}
        <SolutionsSection onSelectCategory={handleOpenWithCategory} />

        {/* 10. Sección — Cómo Trabajamos */}
        <HowWeWorkSection onOpenConfigurator={handleOpenGeneralConfigurator} />

        {/* 11. Sección — Acompañamiento Permanente */}
        <AccompanimentSection />

        {/* 12. Modelo Comercial — Nuestros Tres Servicios */}
        <CommercialModelSection onOpenConfiguratorWithService={handleOpenWithService} />

        {/* 14. Sección — Nuestros Proyectos */}
        <ProjectsSection
          onOpenConfigurator={handleOpenGeneralConfigurator}
          projects={liveProjects}
        />

        {/* 15. Sección — Beneficios */}
        <BenefitsSection />

        {/* 16. Sección — Preguntas Frecuentes */}
        <FaqSection faqs={liveFaqs} />

        {/* 17. Sección Final — Llamado a la Acción */}
        <FinalCtaSection onOpenConfigurator={handleOpenGeneralConfigurator} />

        {/* 18. Contacto y Redes Sociales */}
        <ContactSection onOpenConfigurator={handleOpenGeneralConfigurator} />
      </main>

      <Footer onOpenConfigurator={handleOpenGeneralConfigurator} />

      {/* Botón flotante de WhatsApp visible en todas las páginas públicas */}
      <FloatingWhatsApp />

      {/* 13. Configurador Interactivo — Quiero mi MiniSistema */}
      <ProjectConfiguratorModal
        isOpen={configuratorOpen}
        onClose={() => setConfiguratorOpen(false)}
        preselectedCategory={preselectedCategory}
        preselectedServiceTitle={preselectedServiceTitle}
      />
    </div>
  );
}
