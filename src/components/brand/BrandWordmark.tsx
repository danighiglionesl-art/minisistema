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
 * Punto tipográfico del color inverso al color del texto que lo precede:
 * - Si el texto viene en blanco -> el punto es verde menta (#56D7A1)
 * - Si el texto viene en verde menta -> el punto es blanco (#FFFFFF)
 */
export function InverseDot({ fromColor = "blanco" }: { fromColor?: "blanco" | "menta" }) {
  return (
    <span
      className={
        fromColor === "blanco" ? "text-[var(--color-menta)]" : "text-[var(--color-blanco)]"
      }
    >
      .
    </span>
  );
}

/**
 * Reemplaza automáticamente:
 * 1. Cada mención de "MiniSistema" o "minisistema." por el componente <BrandWordmark />
 * 2. Cada punto de oración (seguido de espacio o fin de texto) por un punto del color inverso
 *    al color base del texto (`fromColor`: "blanco" -> punto menta; "menta" -> punto blanco).
 */
export function renderWithBrandWordmark(
  text: string,
  className?: string,
  fromColor: "blanco" | "menta" = "blanco"
): React.ReactNode {
  if (!text) return text;

  const dotColorClass =
    fromColor === "blanco" ? "text-[var(--color-menta)]" : "text-[var(--color-blanco)]";

  // Primero separamos por apariciones de MiniSistema (absorbiendo el punto inmediatamente posterior si existe)
  const brandParts = text.split(/(MiniSistema\.?|minisistema\.?)/g);

  return brandParts.map((part, idx) => {
    if (/^(MiniSistema|minisistema)\.?$/.test(part)) {
      return <BrandWordmark key={`bw-${idx}`} className={className} />;
    }

    // En los fragmentos de texto restantes, coloreamos los puntos de oración (seguidos de espacio, cierre o final)
    // sin alterar puntos dentro de números (ej: 2.450) ni dominios (ej: www.minisistema.com.ar)
    const dotTokens = part.split(/(\.(?=\s|$|[”")\]!?;:]))/g);
    if (dotTokens.length === 1) {
      return <React.Fragment key={`txt-${idx}`}>{part}</React.Fragment>;
    }

    return (
      <React.Fragment key={`txt-${idx}`}>
        {dotTokens.map((tok, dIdx) =>
          tok === "." ? (
            <span key={`dot-${idx}-${dIdx}`} className={dotColorClass}>
              .
            </span>
          ) : (
            <React.Fragment key={`sub-${idx}-${dIdx}`}>{tok}</React.Fragment>
          )
        )}
      </React.Fragment>
    );
  });
}
