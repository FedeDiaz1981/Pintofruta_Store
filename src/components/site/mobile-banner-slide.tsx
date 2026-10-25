import Link from "next/link";
import type { HeroBannerSlide } from "@/domain/site-content";
import { buttonVariants } from "@/components/ui/button";
import { publicAsset } from "@/lib/catalog";
import { BannerImageLink } from "./banner-image-link";
import styles from "./hero-carousel.module.css";

export function MobileBannerSlide({ slide, heading = "h2", buttonHref = slide.link, priority = false }: {
  slide: HeroBannerSlide;
  heading?: "h1" | "h2";
  buttonHref?: string;
  priority?: boolean;
}) {
  const Heading = heading;

  return (
    <article className={styles.slide}>
      <div className={styles.copy}>
        <span className={styles.badge}>{slide.badge}</span>
        <Heading className={styles.title}>{slide.title}</Heading>
        <p className={styles.subtitle}>{slide.subtitle}</p>
        <Link href={buttonHref} className={`${buttonVariants({ variant: "primary", size: "sm" })} ${styles.link}`}>
          Ir a la galer&iacute;a
        </Link>
      </div>
      <BannerImageLink slide={slide}>
        <picture className={styles.picture}>
          {slide.imageMobile ? <source media="(max-width: 767px)" srcSet={publicAsset(slide.imageMobile)} /> : null}
          <img
            src={publicAsset(slide.image)}
            alt={slide.title}
            className={styles.image}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
          />
        </picture>
      </BannerImageLink>
    </article>
  );
}
