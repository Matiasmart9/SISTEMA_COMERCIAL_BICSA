import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Ícono de Movilidad Propia:
 * Silueta frontal de vehículo moderno de alta gama (sedán deportivo),
 * con parabrisas, faros angulares LED, espejos retrovisores y placa.
 * Basado fielmente en la segunda imagen de referencia del usuario.
 */
export function CarFrontCustomIcon({ size = 26, color = 'currentColor', className = '', style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {/* Neumáticos inferiores */}
      <rect x="3.4" y="17.2" width="2.4" height="2" rx="0.6" fill={color} />
      <rect x="18.2" y="17.2" width="2.4" height="2" rx="0.6" fill={color} />

      {/* Silueta completa del vehículo vista frontal */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.5 5.5C7.2 5.2 8.8 5 12 5C15.2 5 16.8 5.2 17.5 5.5C18.2 5.8 19.3 8.4 20 10.2L21.2 10.2C21.7 10.2 22 10.7 21.8 11.2L21.3 12C22.2 13.5 22.5 15.2 22.5 16.5C22.5 17.5 21.8 18 20.8 18H18.2C17.5 18 17 17.4 16.5 16.5H7.5C7 17.4 6.5 18 5.8 18H3.2C2.2 18 1.5 17.5 1.5 16.5C1.5 15.2 1.8 13.5 2.7 12L2.2 11.2C2 10.7 2.3 10.2 2.8 10.2L4 10.2C4.7 8.4 5.8 5.8 6.5 5.5ZM7.6 6.8C7.1 8.2 6.3 10.2 5.8 11.2H18.2C17.7 10.2 16.9 8.2 16.4 6.8C15.5 6.6 13.8 6.5 12 6.5C10.2 6.5 8.5 6.6 7.6 6.8ZM4.8 13C4 13 3.5 13.6 3.5 14.5C3.5 15.3 4.2 16 5 16C5.8 16 6.5 15.2 6.5 14.2C6.5 13.5 5.8 13 4.8 13ZM19.2 13C20 13 20.5 13.6 20.5 14.5C20.5 15.3 19.8 16 19 16C18.2 16 17.5 15.2 17.5 14.2C17.5 13.5 18.2 13 19.2 13ZM9.5 14.2C9.5 13.9 9.8 13.6 10.2 13.6H13.8C14.2 13.6 14.5 13.9 14.5 14.2V15.5C14.5 15.8 14.2 16.1 13.8 16.1H10.2C9.8 16.1 9.5 15.8 9.5 15.5V14.2ZM8 16.8C8 16.6 8.2 16.4 8.5 16.4H15.5C15.8 16.4 16 16.6 16 16.8C16 17 15.8 17.2 15.5 17.2H8.5C8.2 17.2 8 17 8 16.8Z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Ícono de Plataformas de Transporte (Google Maps Pin):
 * El icónico pin de mapas con los 4 colores (Rojo, Azul, Amarillo y Verde)
 * y centro blanco. Basado fielmente en la tercera imagen del usuario.
 */
export function GoogleMapsPinCustomIcon({ size = 26, className = '', style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {/* Sector Rojo (Superior / Superior Izquierdo) */}
      <path
        d="M50 6C33 6 19.5 19.5 19.5 36.5C19.5 51.5 29.2 64.2 42.8 68.6L50 36.5H80.5C80.5 19.5 67 6 50 6Z"
        fill="#EA4335"
      />
      {/* Sector Amarillo (Inferior Izquierdo) */}
      <path
        d="M19.5 36.5C19.5 45 23 52.8 28.6 58.4L42.8 68.6L50 36.5H19.5Z"
        fill="#FBBC04"
      />
      {/* Sector Verde (Inferior Derecho y punta inferior) */}
      <path
        d="M42.8 68.6C45 69.5 47.4 70 50 70C58.5 70 66.3 66.5 71.9 60.9L50 94L42.8 68.6Z"
        fill="#34A853"
      />
      {/* Sector Azul (Superior Derecho) */}
      <path
        d="M50 36.5L71.9 60.9C77.2 55.2 80.5 46.2 80.5 36.5H50Z"
        fill="#4285F4"
      />
      {/* Círculo central blanco */}
      <circle cx="50" cy="36.5" r="14" fill="#FFFFFF" />
    </svg>
  );
}
