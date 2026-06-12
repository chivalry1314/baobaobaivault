import { useShareSiteBrand } from "@/components/share/site-brand/provider";

type ShareSiteBrandMarkProps = {
  iconClassName?: string;
  textClassName?: string;
  subtitleClassName?: string;
  titleLevel?: "h1" | "div";
};

function BrandBadge({ className }: { className?: string }) {
  const shareSiteBrand = useShareSiteBrand();
  if (shareSiteBrand.logoImageSrc) {
    return (
      <img
        src={shareSiteBrand.logoImageSrc}
        alt={shareSiteBrand.siteShortName}
        className={`${className} object-cover`}
      />
    );
  }

  return (
    <div className={className}>
      <span className="relative z-10">{shareSiteBrand.logoText}</span>
      {shareSiteBrand.logoBadgeText ? (
        <span className="absolute -right-2 -top-2 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-black leading-none text-[var(--foreground)]">
          {shareSiteBrand.logoBadgeText}
        </span>
      ) : null}
    </div>
  );
}

export function ShareSiteBrandMark({
  iconClassName,
  textClassName,
  subtitleClassName,
  titleLevel = "div",
}: ShareSiteBrandMarkProps) {
  const shareSiteBrand = useShareSiteBrand();
  const TitleTag = titleLevel;

  return (
    <>
      <BrandBadge
        className={
          iconClassName ??
          "relative flex h-14 w-14 -rotate-6 items-center justify-center overflow-hidden rounded-2xl border-2 border-[var(--outline)] bg-white text-sm font-black text-[var(--foreground)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        }
      />
      <div>
        <TitleTag
          className={
            textClassName ??
            "text-2xl font-black leading-none tracking-tight text-[var(--foreground)]"
          }
        >
          {shareSiteBrand.siteShortName}
        </TitleTag>
        {shareSiteBrand.showSiteSubtitle && shareSiteBrand.siteSubtitle ? (
          <p
            className={
              subtitleClassName ??
              "text-sm font-extrabold text-[var(--foreground)]"
            }
          >
            {shareSiteBrand.siteSubtitle}
          </p>
        ) : null}
      </div>
    </>
  );
}
