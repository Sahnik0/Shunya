import { getAuth } from "firebase/auth";
import { app } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { User } from "firebase/auth";
import { WhatsNewDialog } from "@/components/WhatsNewDialog";
import { Sidebar } from "@/components/Sidebar";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DashboardNavbar } from "@/components/DashboardNavbar";
import { VercelV0Chat } from "@/components/VercelV0Chat";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUser(user);
        // Show "What's New" dialog after a short delay if not seen before
        const hasSeenWhatsNew = localStorage.getItem('whats-new-seen');
        if (!hasSeenWhatsNew) {
          setTimeout(() => setShowWhatsNew(true), 1000);
        }
      } else {
        navigate('/');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Slow down video playback
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.5; // Slow down to 50% speed
    }
  }, []);

  if (!user) {
    return <LoadingSpinner />;
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <DashboardNavbar user={user} />
        <div className="flex-1 p-6 ml-4 mt-4 rounded-tl-2xl overflow-hidden flex items-center justify-center relative">
          {/* Video Background */}
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-40"
            style={{ filter: 'blur(20px)' }}
          >
            <source src="/1851190-uhd_3840_2160_25fps.mp4" type="video/mp4" />
          </video>
          
          {/* Content Layer */}
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            <VercelV0Chat />
          </div>
        </div>
        <WhatsNewDialog isOpen={showWhatsNew} onClose={() => setShowWhatsNew(false)} />
      </div>
    </main>
  );
}