import Image from "next/image";

const IMAGE_WIDTH = 1118;
const IMAGE_HEIGHT = 223;

export function IsmayilBankLogo({
  size = 52,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const width = Math.round(size * (IMAGE_WIDTH / IMAGE_HEIGHT));

  return (
    <Image
      src="/images/ismayilbank-logo.png"
      alt="IsmayilBank logo"
      width={IMAGE_WIDTH}
      height={IMAGE_HEIGHT}
      className={className}
      // Width caps at `width`; height stays proportional so the wordmark never
      // gets squished when the flex row is tight on small screens.
      style={{ width, height: "auto", maxWidth: "100%" }}
      priority
    />
  );
}
