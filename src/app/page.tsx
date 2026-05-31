import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import HeroCarousel from "@/components/home/HeroCarousel";
import AboutSection from "@/components/home/AboutSection";
import GallerySection from "@/components/home/GallerySection";
import MenuSection from "@/components/home/MenuSection";
import GamesSection from "@/components/home/GamesSection";
import WerewolfSection from "@/components/home/WerewolfSection";
import MiniGamesSection from "@/components/home/MiniGamesSection";
import ActivitiesSection from "@/components/home/ActivitiesSection";
import ContactSection from "@/components/home/ContactSection";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <div className="pt-16 animate-fade-in">
        <HeroCarousel />
        <AboutSection />
        <GallerySection />
        <MenuSection />
        <GamesSection />
        <WerewolfSection />
        <MiniGamesSection />
        <ActivitiesSection />
        <ContactSection />
        <Footer />
      </div>
    </>
  );
}
