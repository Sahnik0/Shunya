import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { PartnersSection } from "@/components/PartnersSection";
import { AIFeatureSection } from "@/components/AIFeatureSection";

const Index = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <Hero />
      <PartnersSection />
      <AIFeatureSection />
    </main>
  );
};

export default Index;
