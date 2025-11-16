import DatabaseWithRestApi from "./DatabaseWithRestApi";
import { Code2, Layers, Zap } from "lucide-react";

export function AIFeatureSection() {
  return (
    <section className="bg-background py-16 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left side - Animated component */}
          <div className="w-full lg:w-1/2 flex justify-center">
            <div className="w-full max-w-[500px]">
              <DatabaseWithRestApi 
                circleText="AI"
                badgeTexts={{
                  first: "Generate",
                  second: "Build",
                  third: "Deploy",
                  fourth: "Test"
                }}
                buttonTexts={{
                  first: "Shunya AI",
                  second: "live_preview"
                }}
                title="AI-powered code generation with live preview"
                lightColor="#00A6F5"
              />
            </div>
          </div>

          {/* Right side - Text content */}
          <div className="w-full lg:w-1/2 space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-semibold text-foreground">
                Build anything with just a{" "}
                <span 
                  style={{
                    background: "linear-gradient(to bottom, hsl(210 100% 70%), hsl(200 100% 60%))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  prompt
                </span>
              </h2>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                Shunya transforms your ideas into production-ready applications. Our AI understands context, 
                maintains proper structure, and generates clean, maintainable code.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Code2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Intelligent Code Generation
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Generate complete file structures with proper naming conventions, imports, and architecture patterns.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Live Preview & Iteration
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    See your application come to life in real-time. Make changes through natural language and watch updates instantly.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Layers className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Smart Terminal Integration
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Need to run commands? Shunya handles terminal operations, package installations, and deployments automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
