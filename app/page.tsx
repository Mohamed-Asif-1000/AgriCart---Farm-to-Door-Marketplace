import Hero from "./components/Hero";
import Categories from "./components/Categories";
import FeaturedFarmers from "./components/FeaturedFarmers";
import HowItWorks from "./components/HowItWorks";
import SmartInsights from "./components/SmartInSights";
import Testimonials from "./components/Testimonials";
import ProductsByCategory from "./components/ProductsByCategory";
import WhyChooseUs from "./components/WhyChooseUs";
import GetStarted from "./components/GetStarted";

export default function Home() {
  return (
    <main>
      <Hero />
      <Categories />
      <HowItWorks />
      <ProductsByCategory />
      <SmartInsights />
      <FeaturedFarmers />
      <Testimonials />
      <WhyChooseUs />
      <GetStarted />
    </main>
  );
}