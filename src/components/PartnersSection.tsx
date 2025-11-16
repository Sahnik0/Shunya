import { InfiniteSlider } from "./InfiniteSlider";
import { ProgressiveBlur } from "./ProgressiveBlur";

export function PartnersSection() {
  return (
    <section className="bg-background pb-16 md:pb-32">
      <div className="group relative m-auto max-w-6xl px-6">
        <div className="flex flex-col items-center md:flex-row">
          <div className="md:max-w-44 md:border-r md:border-border md:pr-6">
            <p className="text-end text-sm text-muted-foreground">Trusted by leading teams</p>
          </div>
          <div className="relative py-6 md:w-[calc(100%-11rem)]">
            <InfiniteSlider
              durationOnHover={20}
              duration={40}
              gap={112}
            >
              <div className="flex">
                <img
                  className="mx-auto h-5 w-fit opacity-60 hover:opacity-100 transition-opacity"
                  src="https://html.tailus.io/blocks/customers/nvidia.svg"
                  alt="Nvidia Logo"
                  height="20"
                  width="auto"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              </div>

              <div className="flex">
                <img
                  className="mx-auto h-4 w-fit opacity-60 hover:opacity-100 transition-opacity"
                  src="https://html.tailus.io/blocks/customers/column.svg"
                  alt="Column Logo"
                  height="16"
                  width="auto"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              </div>
              <div className="flex">
                <img
                  className="mx-auto h-4 w-fit opacity-60 hover:opacity-100 transition-opacity"
                  src="https://html.tailus.io/blocks/customers/github.svg"
                  alt="GitHub Logo"
                  height="16"
                  width="auto"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              </div>
              <div className="flex">
                <img
                  className="mx-auto h-5 w-fit opacity-60 hover:opacity-100 transition-opacity"
                  src="https://html.tailus.io/blocks/customers/nike.svg"
                  alt="Nike Logo"
                  height="20"
                  width="auto"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              </div>
              <div className="flex">
                <img
                  className="mx-auto h-5 w-fit opacity-60 hover:opacity-100 transition-opacity"
                  src="https://html.tailus.io/blocks/customers/lemonsqueezy.svg"
                  alt="Lemon Squeezy Logo"
                  height="20"
                  width="auto"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              </div>
              <div className="flex">
                <img
                  className="mx-auto h-4 w-fit opacity-60 hover:opacity-100 transition-opacity"
                  src="https://html.tailus.io/blocks/customers/laravel.svg"
                  alt="Laravel Logo"
                  height="16"
                  width="auto"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              </div>
              <div className="flex">
                <img
                  className="mx-auto h-7 w-fit opacity-60 hover:opacity-100 transition-opacity"
                  src="https://html.tailus.io/blocks/customers/lilly.svg"
                  alt="Lilly Logo"
                  height="28"
                  width="auto"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              </div>

              <div className="flex">
                <img
                  className="mx-auto h-6 w-fit opacity-60 hover:opacity-100 transition-opacity"
                  src="https://html.tailus.io/blocks/customers/openai.svg"
                  alt="OpenAI Logo"
                  height="24"
                  width="auto"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              </div>
            </InfiniteSlider>

            <ProgressiveBlur
              className="pointer-events-none absolute left-0 top-0 h-full w-20"
              direction="left"
              blurIntensity={1}
            />
            <ProgressiveBlur
              className="pointer-events-none absolute right-0 top-0 h-full w-20"
              direction="right"
              blurIntensity={1}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
