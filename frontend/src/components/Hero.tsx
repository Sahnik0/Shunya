import React, { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginModal } from "@/components/LoginModal";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";

export const Hero = React.memo(() => {
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  const handleGetStarted = () => {
    if (user) {
      // User is already logged in, navigate to dashboard
      navigate('/dashboard');
    } else {
      // User is not logged in, show login modal
      setLoginModalOpen(true);
    }
  };

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-start px-6 py-20 md:py-24"
      style={{
        animation: "fadeIn 0.6s ease-out"
      }}
    >
      <aside className="mb-8 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full border border-border bg-card/50 backdrop-blur-sm max-w-full">
        <span className="text-xs text-center whitespace-nowrap text-muted-foreground">
          AI-powered development is here!
        </span>
        <a
          href="#new-version"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-all active:scale-95 whitespace-nowrap"
          aria-label="Read more about AI features"
        >
          Read more
          <ArrowRight size={12} />
        </a>
      </aside>

      <h1
        className="text-4xl md:text-5xl lg:text-6xl font-medium text-center max-w-3xl px-6 leading-tight mb-6"
        style={{
          background: "var(--hero-text-gradient)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          letterSpacing: "-0.05em"
        }}
      >
        Transform your ideas into <br />reality with AI
      </h1>

      <p className="text-sm md:text-base text-center max-w-2xl px-6 mb-10 text-muted-foreground">
        Build full apps from a prompt - live previews, structure, and deployments.
      </p>

      <div className="flex items-center gap-4 relative z-10 mb-16">
        <Button
          variant="default"
          size="lg"
          className="rounded-lg flex items-center justify-center bg-foreground text-background hover:bg-foreground/90 hover:scale-105 active:scale-95 transition-all"
          aria-label="Get started with Shunya"
          onClick={handleGetStarted}
        >
          Get started
        </Button>
      </div>

      <div className="w-full max-w-5xl relative pb-20">
        <div
          className="absolute left-1/2 w-[90%] pointer-events-none z-0"
          style={{
            top: "-23%",
            transform: "translateX(-50%)",
            filter: "var(--hero-glow-filter)"
          }}
          aria-hidden="true"
        >
          <img
            src="https://i.postimg.cc/Ss6yShGy/glows.png"
            alt=""
            className="w-full h-auto"
            loading="eager"
          />
        </div>
        
        <div className="relative z-10">
          <img
            src="https://i.postimg.cc/SKcdVTr1/Dashboard2.png"
            alt="Dashboard preview showing AI builder interface with code generation and live preview"
            className="w-full h-auto rounded-lg shadow-2xl"
            loading="eager"
            style={{
              boxShadow: "var(--shadow-glow)"
            }}
          />
        </div>
      </div>
      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </section>
  );
});

Hero.displayName = "Hero";
