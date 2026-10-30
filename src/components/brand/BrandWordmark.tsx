import React from "react";

interface BrandWordmarkProps {
  className?: string;
  /**
   * Cuando se inserta dentro de un botón de fondo verde menta sólido,
   * envuelve el logotipo en una cápsula azul petróleo (#112D3A) para
   * preservar el contraste intacto de "mini" (blanco) y "sistema" (menta).
   */
  onMintSurface?: boolean;
}

/**
 * Inserta la imagen oficial del logotipo "minisistema." en línea con el texto,
 * cuidando siempre la identidad visual de la marca.
 */
export function BrandWordmark({ className = "", onMintSurface = false }: BrandWordmarkProps) {
  const imgElement = (
    <img
      src="/brand/logotipo-minisistema.png"
      alt="MiniSistema"
      width={571}
      height={80}
      className={`inline-block h-[0.92em] w-auto align-[-0.06em] select-none object-contain ${className}`}
    />
  );

  if (onMintSurface) {
    return (
      <span className="inline-flex items-center rounded-lg bg-[var(--color-petroleo)] px-2 py-0.5 align-middle shadow-sm">
        {imgElement}
      </span>
    );
  }

  return imgElement;
}

/**
 * Reemplaza automáticamente cada mención de "MiniSistema" o "minisistema."
 * dentro de un texto dinámico por el componente <BrandWordmark />.
 */
export function renderWithBrandWordmark(text: string, className?: string): React.ReactNode {
  if (!text || !/minisistema/i.test(text)) {
    return text;
  }

  // Si "MiniSistema" está justo antes de un punto final (ej: "tu MiniSistema."),
  // absorbemos el punto porque la imagen oficial ya incluye el punto final de marca ("minisistema.").
  const parts = text.split(/(MiniSistema\.?|minisistema\.?)/g);

  return parts.map((part, idx) => {
    if (/^(MiniSistema|minisistema)\.?$/.test(part)) {
      return <BrandWordmark key={idx} className={className} />;
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}
