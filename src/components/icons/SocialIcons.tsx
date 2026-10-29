import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export function WhatsAppIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.002 2C6.488 2 2.002 6.486 2.002 12C2.002 13.766 2.464 15.49 3.342 17.008L2.055 21.709C1.969 22.023 2.256 22.31 2.57 22.224L7.271 20.937C8.789 21.815 10.513 22.277 12.279 22.277H12.283C17.797 22.277 22.283 17.791 22.283 12.277C22.283 9.605 21.243 7.093 19.353 5.203C17.463 3.313 14.951 2 12.002 2ZM12.283 20.25C10.692 20.25 9.131 19.822 7.771 19.015L7.447 18.823L4.455 19.642L5.274 16.65L5.082 16.326C4.275 14.966 3.847 13.405 3.847 11.814C3.847 7.392 7.445 3.794 11.867 3.794C14.009 3.794 16.023 4.628 17.537 6.143C19.052 7.657 20.303 9.671 20.303 11.814C20.303 16.236 16.705 20.25 12.283 20.25ZM16.688 14.248C16.447 14.127 15.261 13.544 15.04 13.463C14.819 13.383 14.658 13.343 14.497 13.584C14.336 13.825 13.874 14.368 13.733 14.529C13.592 14.69 13.452 14.71 13.211 14.589C12.97 14.468 12.192 14.213 11.271 13.392C10.554 12.753 10.07 11.962 9.929 11.721C9.788 11.48 9.914 11.349 10.035 11.229C10.144 11.121 10.276 10.947 10.397 10.806C10.518 10.665 10.558 10.565 10.638 10.404C10.719 10.243 10.678 10.102 10.618 9.982C10.558 9.861 10.075 8.675 9.874 8.192C9.679 7.722 9.48 7.785 9.332 7.778C9.191 7.771 9.03 7.77 8.869 7.77C8.708 7.77 8.447 7.83 8.226 8.071C8.005 8.312 7.382 8.895 7.382 10.081C7.382 11.267 8.246 12.413 8.367 12.574C8.488 12.735 10.068 15.17 12.488 16.215C13.064 16.464 13.513 16.613 13.864 16.724C14.442 16.908 14.968 16.882 15.384 16.82C15.848 16.751 16.812 16.236 17.013 15.673C17.214 15.11 17.214 14.628 17.154 14.528C17.094 14.428 16.929 14.368 16.688 14.248Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function InstagramIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="12"
        r="4.25"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function FacebookIcon({ size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M14.5 13.5H17L18 9.5H14.5V7.5C14.5 6.47 14.5 5.5 16.5 5.5H18V2.14C17.674 2.097 16.443 2 15.143 2C12.428 2 10.5 3.657 10.5 6.7V9.5H7.5V13.5H10.5V22H14.5V13.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
