import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["600", "700", "800"],
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  themeColor: "#112D3A",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.minisistema.com.ar"),
  title: {
    default: "MiniSistema | Sistemas a Medida — Tu negocio es único, tu sistema también",
    template: "%s | MiniSistema — Sistemas a Medida",
  },
  description:
    "Diseñamos, desarrollamos, implementamos y acompañamos sistemas informáticos y soluciones digitales a medida para comercios, empresas, profesionales e instituciones en Argentina.",
  keywords: [
    "Sistemas a medida",
    "Software personalizado",
    "Desarrollo de sistemas",
    "Sistemas para comercios",
    "Aplicaciones web",
    "Desarrollo PWA",
    "Sistemas de gestión personalizados",
    "Desarrollo de software para empresas",
    "Automatización de negocios",
    "Plataformas digitales",
    "MiniSistema",
  ],
  alternates: {
    canonical: "https://www.minisistema.com.ar",
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://www.minisistema.com.ar",
    siteName: "minisistema. — SISTEMAS A MEDIDA",
    title: "MiniSistema | Tu negocio es único. Tu sistema también debería serlo.",
    description:
      "Creamos sistemas digitales a medida que se adaptan a tu negocio desde el primer día y evolucionan con vos en cada nueva etapa.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MiniSistema | Sistemas a Medida",
    description:
      "Tecnología que se adapta a vos, y no al revés. Diseño, desarrollo, implementación y evolución de sistemas a medida.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "minisistema.",
    alternateName: "MiniSistema — Sistemas a Medida",
    url: "https://www.minisistema.com.ar",
    slogan: "Tu negocio es único. Tu sistema también debería serlo.",
    description:
      "Diseño, desarrollo, implementación, mantenimiento y evolución de sistemas informáticos a medida.",
    telephone: "+5493585095475",
    areaServed: {
      "@type": "Country",
      name: "Argentina",
    },
    sameAs: [
      "https://www.instagram.com/mini.sistema/",
      "https://www.facebook.com/mini.sistema",
    ],
  };

  return (
    <html lang="es-AR" className={`${outfit.variable} ${plusJakarta.variable}`}>
      <body className="min-h-dvh bg-[#112D3A] text-[#FFFFFF] antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
