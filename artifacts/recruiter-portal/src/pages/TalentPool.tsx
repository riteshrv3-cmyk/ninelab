import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Search, Bookmark, BookmarkCheck, Github, Linkedin, Globe,
  MapPin, Star, Zap, LogOut, SlidersHorizontal,
  X, Users, TrendingUp, Award, ChevronDown
} from "lucide-react";

interface Student {
  id: number;
  name: string;
  college: string;
  city: string;
  year: number;
  field: string;
  cgpa: string;
  openToWork: boolean;
  workMode: string;
  preferredLocations: string[];
  expectedSalary: string;
  profileStrength: number;
  commitmentScore: number;
  overallScore: number;
  skills: Record<string, number>;
  githubStats?: { username: string; topLanguages: string[]; publicRepos: number; stars: number };
  projects: { id: string; title: string; techStack: string[] }[];
  certifications: { id: string; name: string; issuer: string }[];
  hasLinkedin: boolean;
  hasPortfolio: boolean;
  isPro: boolean;
}

const FAKE_POOL: Student[] = [
  { id: 1, name: "Arjun R.", college: "IIT Bombay", city: "Mumbai", year: 3, field: "Computer Science", cgpa: "9.1", openToWork: true, workMode: "hybrid", preferredLocations: ["Bangalore", "Mumbai"], expectedSalary: "₹8–12 LPA", profileStrength: 94, commitmentScore: 88, overallScore: 91, skills: { "React": 88, "Node.js": 82, "PostgreSQL": 74, "TypeScript": 79 }, githubStats: { username: "arjun-r", topLanguages: ["TypeScript", "Python"], publicRepos: 28, stars: 142 }, projects: [{ id: "1", title: "AI Resume Builder", techStack: ["React", "OpenAI"] }, { id: "2", title: "Campus Connect App", techStack: ["React Native", "Node.js"] }], certifications: [{ id: "1", name: "AWS Cloud Practitioner", issuer: "Amazon" }], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 2, name: "Priya S.", college: "IIT Delhi", city: "Delhi", year: 3, field: "Computer Science", cgpa: "8.9", openToWork: true, workMode: "remote", preferredLocations: ["Bangalore", "Hyderabad", "Remote"], expectedSalary: "₹10–15 LPA", profileStrength: 91, commitmentScore: 85, overallScore: 88, skills: { "Python": 91, "ML/AI": 87, "TensorFlow": 79, "FastAPI": 72 }, githubStats: { username: "priya-s", topLanguages: ["Python", "Jupyter"], publicRepos: 22, stars: 98 }, projects: [{ id: "1", title: "Crop Disease Detection", techStack: ["PyTorch", "Flask"] }], certifications: [{ id: "1", name: "TensorFlow Developer", issuer: "Google" }], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 3, name: "Rohit K.", college: "BITS Pilani", city: "Jaipur", year: 4, field: "Computer Science", cgpa: "8.7", openToWork: true, workMode: "hybrid", preferredLocations: ["Bangalore", "Pune"], expectedSalary: "₹12–18 LPA", profileStrength: 89, commitmentScore: 82, overallScore: 86, skills: { "Go": 84, "Kubernetes": 78, "Docker": 86, "AWS": 80 }, githubStats: { username: "rohit-k", topLanguages: ["Go", "Shell"], publicRepos: 19, stars: 67 }, projects: [{ id: "1", title: "Microservices Orchestrator", techStack: ["Go", "K8s"] }], certifications: [{ id: "1", name: "Certified Kubernetes Admin", issuer: "CNCF" }], hasLinkedin: true, hasPortfolio: false, isPro: true },
  { id: 4, name: "Sneha M.", college: "NIT Trichy", city: "Chennai", year: 3, field: "Information Technology", cgpa: "8.5", openToWork: true, workMode: "hybrid", preferredLocations: ["Chennai", "Bangalore"], expectedSalary: "₹6–10 LPA", profileStrength: 86, commitmentScore: 79, overallScore: 83, skills: { "React": 85, "Vue.js": 72, "Figma": 88, "CSS": 90 }, githubStats: { username: "sneha-m", topLanguages: ["JavaScript", "CSS"], publicRepos: 15, stars: 44 }, projects: [{ id: "1", title: "Design System Library", techStack: ["React", "Storybook"] }], certifications: [{ id: "1", name: "Google UX Design", issuer: "Google" }], hasLinkedin: true, hasPortfolio: true, isPro: false },
  { id: 5, name: "Vikram P.", college: "IIT Madras", city: "Chennai", year: 4, field: "Data Science", cgpa: "9.2", openToWork: true, workMode: "onsite", preferredLocations: ["Hyderabad", "Bangalore", "Chennai"], expectedSalary: "₹15–20 LPA", profileStrength: 93, commitmentScore: 90, overallScore: 92, skills: { "Python": 93, "Spark": 84, "Kafka": 78, "Airflow": 75 }, githubStats: { username: "vikram-p", topLanguages: ["Python", "Scala"], publicRepos: 32, stars: 211 }, projects: [{ id: "1", title: "Real-time Analytics Pipeline", techStack: ["Kafka", "Spark"] }], certifications: [{ id: "1", name: "Databricks Associate", issuer: "Databricks" }], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 6, name: "Ananya G.", college: "VIT Vellore", city: "Vellore", year: 2, field: "Computer Science", cgpa: "8.2", openToWork: true, workMode: "hybrid", preferredLocations: ["Bangalore", "Remote"], expectedSalary: "₹5–8 LPA", profileStrength: 78, commitmentScore: 74, overallScore: 76, skills: { "Java": 80, "Spring Boot": 72, "MySQL": 78, "REST APIs": 81 }, githubStats: { username: "ananya-g", topLanguages: ["Java", "JavaScript"], publicRepos: 12, stars: 28 }, projects: [{ id: "1", title: "E-Commerce Backend", techStack: ["Spring Boot", "MySQL"] }], certifications: [], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 7, name: "Karthik B.", college: "IIT Kharagpur", city: "Kharagpur", year: 3, field: "Electronics & CS", cgpa: "8.8", openToWork: true, workMode: "hybrid", preferredLocations: ["Bangalore", "Hyderabad"], expectedSalary: "₹10–14 LPA", profileStrength: 88, commitmentScore: 83, overallScore: 87, skills: { "C++": 90, "Embedded C": 84, "RTOS": 76, "Python": 70 }, githubStats: { username: "karthik-b", topLanguages: ["C++", "C"], publicRepos: 17, stars: 55 }, projects: [{ id: "1", title: "Smart Home Controller", techStack: ["ESP32", "MQTT"] }], certifications: [{ id: "1", name: "ARM Cortex Certified", issuer: "ARM" }], hasLinkedin: true, hasPortfolio: true, isPro: false },
  { id: 8, name: "Divya N.", college: "IIIT Hyderabad", city: "Hyderabad", year: 3, field: "Computer Science", cgpa: "9.0", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Hyderabad"], expectedSalary: "₹8–12 LPA", profileStrength: 90, commitmentScore: 86, overallScore: 89, skills: { "Rust": 82, "WebAssembly": 75, "C++": 88, "Systems": 84 }, githubStats: { username: "divya-n", topLanguages: ["Rust", "C++"], publicRepos: 24, stars: 130 }, projects: [{ id: "1", title: "Browser JS Engine (mini)", techStack: ["Rust", "WASM"] }], certifications: [], hasLinkedin: false, hasPortfolio: true, isPro: true },
  { id: 9, name: "Aditya L.", college: "NIT Warangal", city: "Hyderabad", year: 4, field: "Information Technology", cgpa: "8.4", openToWork: true, workMode: "hybrid", preferredLocations: ["Hyderabad", "Bangalore"], expectedSalary: "₹8–12 LPA", profileStrength: 83, commitmentScore: 78, overallScore: 81, skills: { "React": 84, "React Native": 79, "Firebase": 82, "Redux": 76 }, githubStats: { username: "aditya-l", topLanguages: ["JavaScript", "Dart"], publicRepos: 20, stars: 72 }, projects: [{ id: "1", title: "Fitness Tracker App", techStack: ["React Native", "Firebase"] }], certifications: [{ id: "1", name: "Meta Front-End Developer", issuer: "Meta" }], hasLinkedin: true, hasPortfolio: true, isPro: false },
  { id: 10, name: "Meera T.", college: "IIT Roorkee", city: "Roorkee", year: 3, field: "Data Science", cgpa: "8.6", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Bangalore", "Delhi"], expectedSalary: "₹10–15 LPA", profileStrength: 87, commitmentScore: 81, overallScore: 85, skills: { "Python": 89, "NLP": 83, "BERT": 77, "LangChain": 80 }, githubStats: { username: "meera-t", topLanguages: ["Python", "R"], publicRepos: 18, stars: 91 }, projects: [{ id: "1", title: "Legal Document Analyzer", techStack: ["LangChain", "OpenAI"] }], certifications: [{ id: "1", name: "DeepLearning.AI Specialization", issuer: "Coursera" }], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 11, name: "Saurabh J.", college: "Pune University", city: "Pune", year: 4, field: "Computer Science", cgpa: "7.9", openToWork: true, workMode: "hybrid", preferredLocations: ["Pune", "Mumbai"], expectedSalary: "₹6–9 LPA", profileStrength: 74, commitmentScore: 71, overallScore: 73, skills: { "Node.js": 81, "Express": 78, "MongoDB": 83, "GraphQL": 70 }, githubStats: { username: "saurabh-j", topLanguages: ["JavaScript", "TypeScript"], publicRepos: 14, stars: 33 }, projects: [{ id: "1", title: "Blog Platform API", techStack: ["Express", "MongoDB"] }], certifications: [], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 12, name: "Pooja V.", college: "BITS Goa", city: "Goa", year: 3, field: "Computer Science", cgpa: "8.3", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Bangalore"], expectedSalary: "₹8–12 LPA", profileStrength: 82, commitmentScore: 76, overallScore: 80, skills: { "Flutter": 88, "Dart": 86, "Firebase": 79, "REST APIs": 73 }, githubStats: { username: "pooja-v", topLanguages: ["Dart", "Swift"], publicRepos: 11, stars: 41 }, projects: [{ id: "1", title: "Campus Food Delivery App", techStack: ["Flutter", "Firebase"] }], certifications: [{ id: "1", name: "Flutter Developer Certificate", issuer: "Google" }], hasLinkedin: true, hasPortfolio: true, isPro: false },
  { id: 13, name: "Harsh A.", college: "IIT Bombay", city: "Mumbai", year: 2, field: "AI/ML", cgpa: "9.3", openToWork: false, workMode: "hybrid", preferredLocations: ["Bangalore", "Mumbai"], expectedSalary: "₹12–18 LPA", profileStrength: 92, commitmentScore: 88, overallScore: 91, skills: { "PyTorch": 90, "Computer Vision": 85, "YOLO": 82, "OpenCV": 88 }, githubStats: { username: "harsh-a", topLanguages: ["Python", "CUDA"], publicRepos: 26, stars: 178 }, projects: [{ id: "1", title: "Real-time Object Detection System", techStack: ["YOLO", "OpenCV"] }], certifications: [{ id: "1", name: "AWS ML Specialty", issuer: "Amazon" }], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 14, name: "Riya C.", college: "NIT Karnataka", city: "Mangalore", year: 3, field: "Information Technology", cgpa: "8.1", openToWork: true, workMode: "hybrid", preferredLocations: ["Bangalore", "Mangalore"], expectedSalary: "₹6–9 LPA", profileStrength: 79, commitmentScore: 73, overallScore: 77, skills: { "React": 82, "Node.js": 75, "MySQL": 78, "CSS": 85 }, githubStats: { username: "riya-c", topLanguages: ["JavaScript", "HTML"], publicRepos: 10, stars: 21 }, projects: [{ id: "1", title: "Student Portal", techStack: ["React", "Node.js"] }], certifications: [], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 15, name: "Nikhil S.", college: "IIT Guwahati", city: "Guwahati", year: 4, field: "Computer Science", cgpa: "8.5", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Bangalore", "Delhi"], expectedSalary: "₹10–14 LPA", profileStrength: 85, commitmentScore: 80, overallScore: 84, skills: { "Solidity": 84, "Web3.js": 79, "Ethereum": 82, "IPFS": 73 }, githubStats: { username: "nikhil-s", topLanguages: ["Solidity", "JavaScript"], publicRepos: 16, stars: 58 }, projects: [{ id: "1", title: "Decentralized Voting DApp", techStack: ["Solidity", "Hardhat"] }], certifications: [{ id: "1", name: "Certified Blockchain Developer", issuer: "101 Blockchains" }], hasLinkedin: true, hasPortfolio: true, isPro: false },
  { id: 16, name: "Kavya R.", college: "IIIT Bangalore", city: "Bangalore", year: 3, field: "Data Science", cgpa: "8.7", openToWork: true, workMode: "hybrid", preferredLocations: ["Bangalore"], expectedSalary: "₹8–13 LPA", profileStrength: 88, commitmentScore: 84, overallScore: 87, skills: { "SQL": 90, "Tableau": 84, "Python": 86, "dbt": 77 }, githubStats: { username: "kavya-r", topLanguages: ["Python", "SQL"], publicRepos: 19, stars: 63 }, projects: [{ id: "1", title: "Sales Analytics Dashboard", techStack: ["Tableau", "PostgreSQL"] }], certifications: [{ id: "1", name: "Google Data Analytics", issuer: "Google" }], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 17, name: "Aman T.", college: "DTU Delhi", city: "Delhi", year: 3, field: "Computer Science", cgpa: "8.0", openToWork: true, workMode: "hybrid", preferredLocations: ["Delhi", "Gurgaon", "Noida"], expectedSalary: "₹7–10 LPA", profileStrength: 77, commitmentScore: 72, overallScore: 75, skills: { "Java": 84, "Spring Boot": 80, "Redis": 72, "Kafka": 68 }, githubStats: { username: "aman-t", topLanguages: ["Java", "Python"], publicRepos: 13, stars: 27 }, projects: [{ id: "1", title: "Cab Booking Service", techStack: ["Spring Boot", "Redis"] }], certifications: [], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 18, name: "Shruti P.", college: "Manipal University", city: "Manipal", year: 2, field: "Computer Science", cgpa: "8.4", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Bangalore", "Hyderabad"], expectedSalary: "₹5–8 LPA", profileStrength: 80, commitmentScore: 75, overallScore: 78, skills: { "Python": 82, "Django": 78, "PostgreSQL": 74, "Docker": 70 }, githubStats: { username: "shruti-p", topLanguages: ["Python", "JavaScript"], publicRepos: 9, stars: 18 }, projects: [{ id: "1", title: "Task Management API", techStack: ["Django", "PostgreSQL"] }], certifications: [{ id: "1", name: "Python for Everybody", issuer: "Michigan Univ." }], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 19, name: "Varun K.", college: "IIT BHU", city: "Varanasi", year: 4, field: "Electronics & CS", cgpa: "8.6", openToWork: true, workMode: "onsite", preferredLocations: ["Bangalore", "Hyderabad", "Delhi"], expectedSalary: "₹10–15 LPA", profileStrength: 86, commitmentScore: 82, overallScore: 85, skills: { "FPGA": 82, "Verilog": 86, "Python": 74, "MATLAB": 78 }, githubStats: { username: "varun-k", topLanguages: ["C", "Python"], publicRepos: 15, stars: 38 }, projects: [{ id: "1", title: "RISC-V CPU on FPGA", techStack: ["Verilog", "Xilinx"] }], certifications: [], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 20, name: "Ishaan M.", college: "BITS Hyderabad", city: "Hyderabad", year: 3, field: "Computer Science", cgpa: "8.8", openToWork: true, workMode: "hybrid", preferredLocations: ["Hyderabad", "Bangalore"], expectedSalary: "₹9–13 LPA", profileStrength: 89, commitmentScore: 85, overallScore: 88, skills: { "Next.js": 86, "React": 90, "Tailwind": 88, "Prisma": 77 }, githubStats: { username: "ishaan-m", topLanguages: ["TypeScript", "JavaScript"], publicRepos: 21, stars: 104 }, projects: [{ id: "1", title: "SaaS Boilerplate Template", techStack: ["Next.js", "Stripe"] }], certifications: [{ id: "1", name: "Next.js Enterprise Course", issuer: "Vercel" }], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 21, name: "Tanya B.", college: "NIT Surathkal", city: "Mangalore", year: 3, field: "AI/ML", cgpa: "8.9", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Bangalore"], expectedSalary: "₹10–15 LPA", profileStrength: 90, commitmentScore: 86, overallScore: 89, skills: { "Hugging Face": 84, "Fine-tuning": 80, "RAG": 82, "LangChain": 86 }, githubStats: { username: "tanya-b", topLanguages: ["Python", "Jupyter"], publicRepos: 17, stars: 89 }, projects: [{ id: "1", title: "LLM-Powered Code Review Bot", techStack: ["LangChain", "GPT-4"] }], certifications: [{ id: "1", name: "LLM Bootcamp", issuer: "Full Stack Deep Learning" }], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 22, name: "Gaurav S.", college: "Thapar University", city: "Patiala", year: 4, field: "Computer Science", cgpa: "7.8", openToWork: true, workMode: "hybrid", preferredLocations: ["Delhi", "Bangalore", "Chandigarh"], expectedSalary: "₹6–9 LPA", profileStrength: 72, commitmentScore: 68, overallScore: 71, skills: { "PHP": 76, "Laravel": 80, "MySQL": 82, "Vue.js": 74 }, githubStats: { username: "gaurav-s", topLanguages: ["PHP", "JavaScript"], publicRepos: 11, stars: 15 }, projects: [{ id: "1", title: "Hotel Booking System", techStack: ["Laravel", "MySQL"] }], certifications: [], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 23, name: "Nandini R.", college: "IIT Hyderabad", city: "Hyderabad", year: 3, field: "Data Science", cgpa: "9.0", openToWork: false, workMode: "hybrid", preferredLocations: ["Hyderabad", "Bangalore"], expectedSalary: "₹12–18 LPA", profileStrength: 91, commitmentScore: 87, overallScore: 90, skills: { "R": 88, "Statistics": 92, "Python": 84, "Power BI": 80 }, githubStats: { username: "nandini-r", topLanguages: ["R", "Python"], publicRepos: 20, stars: 77 }, projects: [{ id: "1", title: "Customer Churn Prediction", techStack: ["R", "XGBoost"] }], certifications: [{ id: "1", name: "IBM Data Science Professional", issuer: "IBM" }], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 24, name: "Aryan D.", college: "NSUT Delhi", city: "Delhi", year: 3, field: "Computer Science", cgpa: "8.1", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Delhi", "Bangalore"], expectedSalary: "₹7–10 LPA", profileStrength: 81, commitmentScore: 76, overallScore: 79, skills: { "Python": 80, "Scrapy": 75, "Selenium": 78, "Beautiful Soup": 82 }, githubStats: { username: "aryan-d", topLanguages: ["Python", "Shell"], publicRepos: 14, stars: 32 }, projects: [{ id: "1", title: "Product Price Tracker", techStack: ["Scrapy", "PostgreSQL"] }], certifications: [], hasLinkedin: false, hasPortfolio: true, isPro: false },
  { id: 25, name: "Keerthi V.", college: "SSN College Chennai", city: "Chennai", year: 4, field: "Information Technology", cgpa: "8.3", openToWork: true, workMode: "hybrid", preferredLocations: ["Chennai", "Bangalore"], expectedSalary: "₹7–10 LPA", profileStrength: 80, commitmentScore: 75, overallScore: 78, skills: { "Angular": 82, "TypeScript": 84, "RxJS": 78, "Jest": 72 }, githubStats: { username: "keerthi-v", topLanguages: ["TypeScript", "JavaScript"], publicRepos: 13, stars: 24 }, projects: [{ id: "1", title: "Employee Management Portal", techStack: ["Angular", "Spring Boot"] }], certifications: [{ id: "1", name: "Angular Developer", issuer: "Google" }], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 26, name: "Rohan C.", college: "IIT Indore", city: "Indore", year: 4, field: "Computer Science", cgpa: "8.7", openToWork: true, workMode: "hybrid", preferredLocations: ["Bangalore", "Hyderabad", "Mumbai"], expectedSalary: "₹12–18 LPA", profileStrength: 88, commitmentScore: 84, overallScore: 87, skills: { "C++": 88, "Competitive Programming": 92, "DSA": 90, "System Design": 82 }, githubStats: { username: "rohan-c", topLanguages: ["C++", "Python"], publicRepos: 18, stars: 110 }, projects: [{ id: "1", title: "Distributed Task Scheduler", techStack: ["C++", "gRPC"] }], certifications: [], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 27, name: "Simran K.", college: "DCE Delhi", city: "Delhi", year: 3, field: "Computer Science", cgpa: "8.0", openToWork: true, workMode: "hybrid", preferredLocations: ["Delhi", "Noida", "Gurgaon"], expectedSalary: "₹7–10 LPA", profileStrength: 76, commitmentScore: 72, overallScore: 75, skills: { "React": 80, "JavaScript": 82, "CSS": 86, "Figma": 78 }, githubStats: { username: "simran-k", topLanguages: ["JavaScript", "CSS"], publicRepos: 10, stars: 19 }, projects: [{ id: "1", title: "Portfolio Website Builder", techStack: ["React", "Netlify"] }], certifications: [], hasLinkedin: true, hasPortfolio: true, isPro: false },
  { id: 28, name: "Rahul G.", college: "PSG Tech Coimbatore", city: "Coimbatore", year: 4, field: "Computer Science", cgpa: "8.2", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Bangalore", "Chennai"], expectedSalary: "₹7–11 LPA", profileStrength: 82, commitmentScore: 77, overallScore: 80, skills: { "Node.js": 84, "Microservices": 78, "RabbitMQ": 72, "Docker": 80 }, githubStats: { username: "rahul-g", topLanguages: ["JavaScript", "Go"], publicRepos: 15, stars: 43 }, projects: [{ id: "1", title: "Notification Service", techStack: ["Node.js", "RabbitMQ"] }], certifications: [{ id: "1", name: "Docker & Kubernetes", issuer: "KodeKloud" }], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 29, name: "Aditi M.", college: "IIIT Allahabad", city: "Allahabad", year: 3, field: "AI/ML", cgpa: "8.6", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Bangalore"], expectedSalary: "₹9–13 LPA", profileStrength: 85, commitmentScore: 80, overallScore: 84, skills: { "Python": 88, "Scikit-learn": 84, "MLflow": 76, "Feature Engineering": 82 }, githubStats: { username: "aditi-m", topLanguages: ["Python", "R"], publicRepos: 16, stars: 54 }, projects: [{ id: "1", title: "Credit Risk ML Pipeline", techStack: ["Scikit-learn", "MLflow"] }], certifications: [{ id: "1", name: "ML Engineering for Production", issuer: "Coursera" }], hasLinkedin: true, hasPortfolio: true, isPro: false },
  { id: 30, name: "Siddharth N.", college: "VJTI Mumbai", city: "Mumbai", year: 4, field: "Computer Science", cgpa: "8.1", openToWork: true, workMode: "hybrid", preferredLocations: ["Mumbai", "Pune", "Bangalore"], expectedSalary: "₹8–12 LPA", profileStrength: 80, commitmentScore: 76, overallScore: 79, skills: { "React Native": 86, "Expo": 82, "Firebase": 80, "Redux": 74 }, githubStats: { username: "siddharth-n", topLanguages: ["JavaScript", "TypeScript"], publicRepos: 13, stars: 36 }, projects: [{ id: "1", title: "Hyperlocal Delivery App", techStack: ["React Native", "Node.js"] }], certifications: [], hasLinkedin: true, hasPortfolio: true, isPro: false },
  { id: 31, name: "Lavanya S.", college: "IIT Kanpur", city: "Kanpur", year: 3, field: "Computer Science", cgpa: "9.1", openToWork: false, workMode: "hybrid", preferredLocations: ["Bangalore", "Hyderabad"], expectedSalary: "₹15–22 LPA", profileStrength: 93, commitmentScore: 89, overallScore: 92, skills: { "Python": 92, "Research": 88, "PyTorch": 90, "CUDA": 84 }, githubStats: { username: "lavanya-s", topLanguages: ["Python", "C++"], publicRepos: 24, stars: 196 }, projects: [{ id: "1", title: "Efficient Transformer Architecture", techStack: ["PyTorch", "CUDA"] }], certifications: [{ id: "1", name: "CVPR Paper Publication", issuer: "IEEE" }], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 32, name: "Ayush J.", college: "Netaji Subhas University", city: "Kolkata", year: 3, field: "Computer Science", cgpa: "7.9", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Kolkata", "Bangalore"], expectedSalary: "₹5–8 LPA", profileStrength: 73, commitmentScore: 69, overallScore: 72, skills: { "Python": 78, "Flask": 74, "SQLite": 72, "REST": 76 }, githubStats: { username: "ayush-j", topLanguages: ["Python", "JavaScript"], publicRepos: 8, stars: 12 }, projects: [{ id: "1", title: "Quiz Web App", techStack: ["Flask", "SQLite"] }], certifications: [], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 33, name: "Prateek A.", college: "IIIT Sri City", city: "Hyderabad", year: 4, field: "Electronics & CS", cgpa: "8.3", openToWork: true, workMode: "hybrid", preferredLocations: ["Hyderabad", "Chennai", "Bangalore"], expectedSalary: "₹8–12 LPA", profileStrength: 82, commitmentScore: 78, overallScore: 81, skills: { "Python": 82, "IoT": 78, "MQTT": 74, "Raspberry Pi": 80 }, githubStats: { username: "prateek-a", topLanguages: ["Python", "C"], publicRepos: 14, stars: 31 }, projects: [{ id: "1", title: "Smart Greenhouse Monitor", techStack: ["Raspberry Pi", "MQTT"] }], certifications: [], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 34, name: "Monika R.", college: "SRM University", city: "Chennai", year: 3, field: "Information Technology", cgpa: "8.0", openToWork: true, workMode: "hybrid", preferredLocations: ["Chennai", "Bangalore", "Hyderabad"], expectedSalary: "₹6–9 LPA", profileStrength: 77, commitmentScore: 73, overallScore: 76, skills: { "React": 80, "Node.js": 74, "MongoDB": 78, "Figma": 82 }, githubStats: { username: "monika-r", topLanguages: ["JavaScript", "CSS"], publicRepos: 11, stars: 22 }, projects: [{ id: "1", title: "Freelance Marketplace", techStack: ["MERN", "Stripe"] }], certifications: [{ id: "1", name: "Full Stack Web Dev", issuer: "Udemy" }], hasLinkedin: true, hasPortfolio: true, isPro: false },
  { id: 35, name: "Dhruv M.", college: "IIT Jodhpur", city: "Jodhpur", year: 3, field: "Computer Science", cgpa: "8.5", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Bangalore"], expectedSalary: "₹9–13 LPA", profileStrength: 84, commitmentScore: 79, overallScore: 83, skills: { "Elixir": 78, "Phoenix": 74, "PostgreSQL": 82, "LiveView": 70 }, githubStats: { username: "dhruv-m", topLanguages: ["Elixir", "JavaScript"], publicRepos: 12, stars: 48 }, projects: [{ id: "1", title: "Real-time Chat Application", techStack: ["Phoenix LiveView", "PostgreSQL"] }], certifications: [], hasLinkedin: false, hasPortfolio: true, isPro: false },
  { id: 36, name: "Bhavna T.", college: "Nirma University", city: "Ahmedabad", year: 4, field: "Computer Science", cgpa: "8.2", openToWork: true, workMode: "hybrid", preferredLocations: ["Ahmedabad", "Bangalore", "Mumbai"], expectedSalary: "₹7–11 LPA", profileStrength: 81, commitmentScore: 77, overallScore: 80, skills: { "Python": 84, "Tableau": 80, "SQL": 86, "Excel": 78 }, githubStats: { username: "bhavna-t", topLanguages: ["Python", "SQL"], publicRepos: 10, stars: 17 }, projects: [{ id: "1", title: "Supply Chain Dashboard", techStack: ["Tableau", "Python"] }], certifications: [{ id: "1", name: "Tableau Desktop Specialist", issuer: "Tableau" }], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 37, name: "Surya K.", college: "CEG Anna University", city: "Chennai", year: 3, field: "Computer Science", cgpa: "8.4", openToWork: true, workMode: "hybrid", preferredLocations: ["Chennai", "Bangalore"], expectedSalary: "₹7–10 LPA", profileStrength: 83, commitmentScore: 78, overallScore: 82, skills: { "Java": 86, "Android": 84, "Jetpack Compose": 78, "Kotlin": 82 }, githubStats: { username: "surya-k", topLanguages: ["Kotlin", "Java"], publicRepos: 13, stars: 29 }, projects: [{ id: "1", title: "Health Tracker Android App", techStack: ["Kotlin", "Room DB"] }], certifications: [{ id: "1", name: "Associate Android Developer", issuer: "Google" }], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 38, name: "Pallavi G.", college: "DAIICT Gandhinagar", city: "Gandhinagar", year: 4, field: "Data Science", cgpa: "8.7", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Ahmedabad", "Bangalore"], expectedSalary: "₹9–14 LPA", profileStrength: 87, commitmentScore: 83, overallScore: 86, skills: { "Python": 88, "Time Series": 82, "Prophet": 78, "SQL": 86 }, githubStats: { username: "pallavi-g", topLanguages: ["Python", "R"], publicRepos: 18, stars: 62 }, projects: [{ id: "1", title: "Stock Price Forecasting System", techStack: ["Prophet", "Streamlit"] }], certifications: [{ id: "1", name: "Time Series Analysis", issuer: "Coursera" }], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 39, name: "Kunal B.", college: "COEP Pune", city: "Pune", year: 3, field: "Computer Science", cgpa: "8.0", openToWork: true, workMode: "hybrid", preferredLocations: ["Pune", "Mumbai", "Bangalore"], expectedSalary: "₹6–9 LPA", profileStrength: 76, commitmentScore: 71, overallScore: 74, skills: { "React": 78, "Python": 76, "FastAPI": 72, "PostgreSQL": 74 }, githubStats: { username: "kunal-b", topLanguages: ["Python", "JavaScript"], publicRepos: 10, stars: 14 }, projects: [{ id: "1", title: "College Event Management", techStack: ["React", "FastAPI"] }], certifications: [], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 40, name: "Shreya L.", college: "IIT Ropar", city: "Ropar", year: 3, field: "AI/ML", cgpa: "8.9", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Bangalore", "Delhi"], expectedSalary: "₹10–15 LPA", profileStrength: 90, commitmentScore: 86, overallScore: 89, skills: { "Reinforcement Learning": 82, "PyTorch": 88, "OpenAI Gym": 80, "Python": 92 }, githubStats: { username: "shreya-l", topLanguages: ["Python", "C++"], publicRepos: 20, stars: 118 }, projects: [{ id: "1", title: "RL Agent for Trading", techStack: ["PyTorch", "OpenAI Gym"] }], certifications: [{ id: "1", name: "Reinforcement Learning Specialization", issuer: "Alberta Univ." }], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 41, name: "Vishal P.", college: "NIT Raipur", city: "Raipur", year: 4, field: "Computer Science", cgpa: "7.9", openToWork: true, workMode: "hybrid", preferredLocations: ["Bangalore", "Hyderabad", "Pune"], expectedSalary: "₹6–9 LPA", profileStrength: 73, commitmentScore: 70, overallScore: 72, skills: { "C#": 78, ".NET": 80, "Azure": 72, "SQL Server": 76 }, githubStats: { username: "vishal-p", topLanguages: ["C#", "JavaScript"], publicRepos: 9, stars: 11 }, projects: [{ id: "1", title: "Inventory Management System", techStack: [".NET", "SQL Server"] }], certifications: [{ id: "1", name: "Azure Fundamentals AZ-900", issuer: "Microsoft" }], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 42, name: "Ankita S.", college: "IIIT Gwalior", city: "Gwalior", year: 3, field: "Computer Science", cgpa: "8.3", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Delhi", "Bangalore"], expectedSalary: "₹7–10 LPA", profileStrength: 81, commitmentScore: 76, overallScore: 80, skills: { "Python": 82, "Selenium": 78, "Pytest": 80, "CI/CD": 74 }, githubStats: { username: "ankita-s", topLanguages: ["Python", "Shell"], publicRepos: 12, stars: 25 }, projects: [{ id: "1", title: "Automated E2E Testing Framework", techStack: ["Selenium", "Python"] }], certifications: [{ id: "1", name: "ISTQB Foundation", issuer: "ISTQB" }], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 43, name: "Abhishek V.", college: "IIT (ISM) Dhanbad", city: "Dhanbad", year: 4, field: "Computer Science", cgpa: "8.4", openToWork: true, workMode: "onsite", preferredLocations: ["Bangalore", "Mumbai", "Delhi"], expectedSalary: "₹10–15 LPA", profileStrength: 84, commitmentScore: 80, overallScore: 83, skills: { "Kubernetes": 82, "Terraform": 80, "GCP": 78, "Ansible": 74 }, githubStats: { username: "abhishek-v", topLanguages: ["HCL", "Shell"], publicRepos: 14, stars: 41 }, projects: [{ id: "1", title: "Multi-Cloud IaC Templates", techStack: ["Terraform", "Ansible"] }], certifications: [{ id: "1", name: "GCP Associate Cloud Engineer", issuer: "Google" }], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 44, name: "Deepika N.", college: "Amity University Noida", city: "Noida", year: 3, field: "Information Technology", cgpa: "7.8", openToWork: true, workMode: "hybrid", preferredLocations: ["Delhi", "Noida", "Gurgaon"], expectedSalary: "₹5–7 LPA", profileStrength: 71, commitmentScore: 67, overallScore: 70, skills: { "React": 74, "HTML": 82, "CSS": 80, "JavaScript": 76 }, githubStats: undefined, projects: [{ id: "1", title: "Personal Portfolio", techStack: ["HTML", "CSS"] }], certifications: [{ id: "1", name: "Front-End Web Dev", issuer: "freeCodeCamp" }], hasLinkedin: true, hasPortfolio: true, isPro: false },
  { id: 45, name: "Harshit A.", college: "IIT Patna", city: "Patna", year: 3, field: "Computer Science", cgpa: "8.6", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Bangalore", "Hyderabad"], expectedSalary: "₹9–13 LPA", profileStrength: 86, commitmentScore: 81, overallScore: 85, skills: { "Swift": 84, "SwiftUI": 80, "CoreData": 76, "Combine": 72 }, githubStats: { username: "harshit-a", topLanguages: ["Swift", "Objective-C"], publicRepos: 13, stars: 39 }, projects: [{ id: "1", title: "Personal Finance iOS App", techStack: ["SwiftUI", "CoreData"] }], certifications: [{ id: "1", name: "iOS App Development Bootcamp", issuer: "Udemy" }], hasLinkedin: true, hasPortfolio: true, isPro: false },
  { id: 46, name: "Riddhi J.", college: "LNMIIT Jaipur", city: "Jaipur", year: 4, field: "Computer Science", cgpa: "8.1", openToWork: true, workMode: "hybrid", preferredLocations: ["Jaipur", "Delhi", "Bangalore"], expectedSalary: "₹6–9 LPA", profileStrength: 78, commitmentScore: 73, overallScore: 77, skills: { "Python": 80, "SQL": 82, "Power BI": 76, "Excel": 80 }, githubStats: { username: "riddhi-j", topLanguages: ["Python", "SQL"], publicRepos: 9, stars: 16 }, projects: [{ id: "1", title: "Healthcare Analytics Report", techStack: ["Power BI", "Python"] }], certifications: [{ id: "1", name: "Power BI Data Analyst", issuer: "Microsoft" }], hasLinkedin: true, hasPortfolio: false, isPro: false },
  { id: 47, name: "Tanmay R.", college: "BITS Pilani", city: "Pilani", year: 2, field: "Computer Science", cgpa: "9.0", openToWork: false, workMode: "hybrid", preferredLocations: ["Bangalore", "Mumbai"], expectedSalary: "₹12–18 LPA", profileStrength: 91, commitmentScore: 87, overallScore: 90, skills: { "React": 88, "GraphQL": 82, "AWS Lambda": 78, "DynamoDB": 74 }, githubStats: { username: "tanmay-r", topLanguages: ["TypeScript", "Python"], publicRepos: 22, stars: 143 }, projects: [{ id: "1", title: "Serverless E-Commerce", techStack: ["AWS Lambda", "React", "DynamoDB"] }], certifications: [{ id: "1", name: "AWS Solutions Architect Associate", issuer: "Amazon" }], hasLinkedin: true, hasPortfolio: true, isPro: true },
  { id: 48, name: "Gargi S.", college: "Jadavpur University", city: "Kolkata", year: 3, field: "Computer Science", cgpa: "8.5", openToWork: true, workMode: "remote", preferredLocations: ["Remote", "Kolkata", "Bangalore"], expectedSalary: "₹8–12 LPA", profileStrength: 85, commitmentScore: 80, overallScore: 84, skills: { "Go": 80, "gRPC": 76, "Protobuf": 74, "PostgreSQL": 82 }, githubStats: { username: "gargi-s", topLanguages: ["Go", "Python"], publicRepos: 16, stars: 57 }, projects: [{ id: "1", title: "Distributed File Storage", techStack: ["Go", "gRPC"] }], certifications: [], hasLinkedin: true, hasPortfolio: true, isPro: false },
  { id: 49, name: "Yash B.", college: "DTU Delhi", city: "Delhi", year: 3, field: "AI/ML", cgpa: "8.3", openToWork: true, workMode: "hybrid", preferredLocations: ["Delhi", "Gurgaon", "Bangalore"], expectedSalary: "₹8–12 LPA", profileStrength: 82, commitmentScore: 78, overallScore: 81, skills: { "Python": 86, "Stable Diffusion": 80, "ComfyUI": 76, "ControlNet": 74 }, githubStats: { username: "yash-b", topLanguages: ["Python", "Jupyter"], publicRepos: 15, stars: 68 }, projects: [{ id: "1", title: "AI Image Generation Pipeline", techStack: ["Stable Diffusion", "Gradio"] }], certifications: [], hasLinkedin: true, hasPortfolio: true, isPro: false },
  { id: 50, name: "Kriti M.", college: "IIT Delhi", city: "Delhi", year: 4, field: "Computer Science", cgpa: "9.2", openToWork: true, workMode: "onsite", preferredLocations: ["Bangalore", "Delhi", "Hyderabad"], expectedSalary: "₹18–25 LPA", profileStrength: 95, commitmentScore: 91, overallScore: 94, skills: { "Systems Programming": 92, "C++": 94, "Distributed Systems": 88, "Go": 86 }, githubStats: { username: "kriti-m", topLanguages: ["C++", "Go"], publicRepos: 30, stars: 264 }, projects: [{ id: "1", title: "High-Performance Key-Value Store", techStack: ["C++", "LSMT"] }, { id: "2", title: "Distributed Consensus Algorithm", techStack: ["Go", "Raft"] }], certifications: [{ id: "1", name: "ICPC Regionalist", issuer: "ICPC Foundation" }], hasLinkedin: true, hasPortfolio: true, isPro: true },
];

const WORK_MODES = ["All", "remote", "hybrid", "onsite"];
const FIELDS = ["All", "Computer Science", "Information Technology", "Electronics", "Data Science", "AI/ML"];
const YEARS = ["All", "1", "2", "3", "4"];
const CGPA_FILTER = ["All", "7.5+", "8.0+", "8.5+", "9.0+"];

function ScoreBadge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center" title={label}>
      <div className="text-sm font-black" style={{ color }}>{value}</div>
      <div className="text-[9px] text-[#94a3b8] uppercase font-bold">{label}</div>
    </div>
  );
}

function StudentCard({ student, shortlisted, onShortlist, onClick }: {
  student: Student;
  shortlisted: boolean;
  onShortlist: (id: number) => void;
  onClick: () => void;
}) {
  const initials = student.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
  const topSkills = Object.entries(student.skills).sort(([, a], [, b]) => b - a).slice(0, 3);
  const strengthColor = student.profileStrength >= 85 ? "#10b981" : student.profileStrength >= 70 ? "#f97316" : "#ef4444";
  const gradients = [
    "from-[#4f46e5] to-[#6366f1]",
    "from-[#0ea5e9] to-[#38bdf8]",
    "from-[#10b981] to-[#34d399]",
    "from-[#f97316] to-[#fb923c]",
    "from-[#8b5cf6] to-[#a78bfa]",
    "from-[#ec4899] to-[#f472b6]",
  ];
  const gradient = gradients[student.id % gradients.length];

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white rounded-2xl border border-[#f1f0f9] p-5 cursor-pointer hover:border-[#4f46e5]/30 hover:shadow-[0_8px_32px_rgba(79,70,229,0.08)] transition-all group relative"
      onClick={onClick}
    >
      <button
        onClick={e => { e.stopPropagation(); onShortlist(student.id); }}
        className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[#f8fafc] transition-colors"
        title={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      >
        {shortlisted
          ? <BookmarkCheck className="w-5 h-5 text-[#4f46e5]" />
          : <Bookmark className="w-5 h-5 text-[#d1d5db] group-hover:text-[#4f46e5] transition-colors" />
        }
      </button>

      <div className="flex items-start gap-3 mb-3 pr-8">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-base flex-shrink-0`}>
          {initials}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-[#0f172a] text-base leading-tight">{student.name}</h3>
            {student.openToWork && (
              <span className="flex items-center gap-1 text-[10px] font-black text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse" />OPEN
              </span>
            )}
            {student.isPro && (
              <span className="text-[10px] font-black text-[#f59e0b] bg-[#fef3c7] px-2 py-0.5 rounded-full">PRO</span>
            )}
          </div>
          <p className="text-xs text-[#64748b] font-medium mt-0.5 truncate">{student.college}</p>
          <p className="text-xs text-[#94a3b8] mt-0.5">{student.field} · Year {student.year}</p>
        </div>
      </div>

      <div className="flex items-center justify-between bg-[#fafafa] rounded-xl p-3 mb-3">
        <ScoreBadge value={student.profileStrength} label="Profile" color={strengthColor} />
        <div className="w-px h-8 bg-[#f0f0f0]" />
        <ScoreBadge value={student.commitmentScore} label="Commit" color="#4f46e5" />
        <div className="w-px h-8 bg-[#f0f0f0]" />
        <ScoreBadge value={student.overallScore} label="AI Score" color="#0ea5e9" />
        <div className="w-px h-8 bg-[#f0f0f0]" />
        <ScoreBadge value={parseFloat(student.cgpa)} label="CGPA" color="#f59e0b" />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-[10px] font-bold bg-[#e0e7ff] text-[#4f46e5] px-2 py-1 rounded-lg">
          {student.workMode === "remote" ? "🏠 Remote" : student.workMode === "hybrid" ? "⚡ Hybrid" : "🏢 Onsite"}
        </span>
        {student.preferredLocations.slice(0, 2).map(loc => (
          <span key={loc} className="text-[10px] font-bold bg-[#f0fdf4] text-[#10b981] px-2 py-1 rounded-lg flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" />{loc}
          </span>
        ))}
        <span className="text-[10px] font-bold bg-[#fef3c7] text-[#d97706] px-2 py-1 rounded-lg">
          {student.expectedSalary}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {topSkills.map(([skill, score]) => (
          <span key={skill} className="text-[10px] font-bold bg-[#f8fafc] border border-[#e2e8f0] text-[#475569] px-2 py-1 rounded-lg">
            {skill} <span className="text-[#4f46e5]">{Math.round(score)}%</span>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-[#64748b]">
        {student.githubStats && (
          <>
            <span className="flex items-center gap-1"><Github className="w-3 h-3" /> @{student.githubStats.username}</span>
            <span>{student.githubStats.publicRepos} repos</span>
            <span className="font-bold text-[#4f46e5]">{student.githubStats.topLanguages[0]}</span>
          </>
        )}
        {student.hasLinkedin && <Linkedin className="w-3 h-3 text-[#0077b5]" />}
        {student.hasPortfolio && <Globe className="w-3 h-3 text-[#64748b]" />}
      </div>
    </motion.div>
  );
}

export default function TalentPool() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [shortlisted, setShortlisted] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("shortlist") || "[]"); } catch { return []; }
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ workMode: "All", field: "All", year: "All", cgpa: "All", hasGithub: false, hasProjects: false, openOnly: false });

  const recruiter = JSON.parse(localStorage.getItem("recruiter") || "{}");

  const toggleShortlist = (id: number) => {
    const updated = shortlisted.includes(id) ? shortlisted.filter(s => s !== id) : [...shortlisted, id];
    setShortlisted(updated);
    localStorage.setItem("shortlist", JSON.stringify(updated));
  };

  const logout = () => { localStorage.removeItem("recruiter"); setLocation("/login"); };

  const filtered = useMemo(() => FAKE_POOL.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.college.toLowerCase().includes(q) && !s.field.toLowerCase().includes(q) && !Object.keys(s.skills).some(sk => sk.toLowerCase().includes(q))) return false;
    }
    if (filters.workMode !== "All" && s.workMode !== filters.workMode) return false;
    if (filters.field !== "All" && !s.field.toLowerCase().includes(filters.field.toLowerCase())) return false;
    if (filters.year !== "All" && s.year !== parseInt(filters.year)) return false;
    if (filters.cgpa !== "All") {
      const min = parseFloat(filters.cgpa.replace("+", ""));
      if (parseFloat(s.cgpa) < min) return false;
    }
    if (filters.hasGithub && !s.githubStats) return false;
    if (filters.hasProjects && s.projects.length === 0) return false;
    if (filters.openOnly && !s.openToWork) return false;
    return true;
  }).sort((a, b) => b.profileStrength - a.profileStrength), [search, filters]);

  const shortlistedCount = shortlisted.length;
  const avgStrength = Math.round(FAKE_POOL.reduce((s, st) => s + st.profileStrength, 0) / FAKE_POOL.length);
  const withGithub = FAKE_POOL.filter(s => s.githubStats).length;
  const proCount = FAKE_POOL.filter(s => s.isPro).length;
  const openCount = FAKE_POOL.filter(s => s.openToWork).length;

  const activeFilterCount = [
    filters.workMode !== "All", filters.field !== "All", filters.year !== "All",
    filters.cgpa !== "All", filters.hasGithub, filters.hasProjects, filters.openOnly
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#f8fafc]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="bg-white border-b border-[#f0f4ff] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#f97316] rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white fill-white" />
              </div>
              <span className="font-black text-[#0f172a] text-lg">ninelab</span>
            </div>
            <span className="text-[#94a3b8] text-sm hidden sm:block">· Recruiter Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/shortlist")}
              className="flex items-center gap-2 text-sm font-bold text-[#4f46e5] bg-[#eef2ff] px-3 py-2 rounded-xl hover:bg-[#e0e7ff] transition-colors"
            >
              <BookmarkCheck className="w-4 h-4" />
              Shortlist {shortlistedCount > 0 && <span className="bg-[#4f46e5] text-white text-xs px-1.5 py-0.5 rounded-full">{shortlistedCount}</span>}
            </button>
            <div className="flex items-center gap-2 text-sm text-[#64748b]">
              <div className="w-7 h-7 bg-[#e0e7ff] rounded-full flex items-center justify-center">
                <span className="text-xs font-black text-[#4f46e5]">{recruiter.name?.[0] || "R"}</span>
              </div>
              <span className="hidden sm:block font-medium">{recruiter.company || "Recruiter"}</span>
            </div>
            <button onClick={logout} className="text-[#94a3b8] hover:text-[#64748b] transition-colors p-1.5">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#0f172a] mb-1">Talent Pool</h1>
              <p className="text-[#64748b] text-sm">
                Showing <span className="font-bold text-[#0f172a]">{filtered.length}</span> verified candidates
                {search && <> matching "<span className="text-[#4f46e5]">{search}</span>"</>}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-[#f0fdf4] border border-[#86efac] px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              <span className="text-xs font-bold text-[#10b981]">{openCount} actively hiring</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: "Total Candidates", value: "1,247", color: "#4f46e5", sub: "+84 this week" },
            { icon: TrendingUp, label: "Avg Profile Strength", value: `${avgStrength}%`, color: "#10b981", sub: "Industry-verified" },
            { icon: Star, label: "With GitHub", value: `${withGithub}`, color: "#f59e0b", sub: "Real project proof" },
            { icon: Award, label: "PRO Members", value: `${proCount}`, color: "#0ea5e9", sub: "Top-tier candidates" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="bg-white rounded-2xl border border-[#f0f4ff] p-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${stat.color}15` }}>
                  <stat.icon className="w-4.5 h-4.5" style={{ color: stat.color }} />
                </div>
                <p className="font-black text-[#0f172a] text-xl leading-none">{stat.value}</p>
              </div>
              <p className="text-[10px] text-[#94a3b8] font-bold uppercase">{stat.label}</p>
              <p className="text-[10px] text-[#10b981] font-semibold mt-0.5">{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <input
              type="text" placeholder="Search by name, college, field, or skill (e.g. React, Python, IIT)..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#e5e7eb] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30 focus:border-[#4f46e5] bg-white transition-colors"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors ${showFilters ? "bg-[#4f46e5] text-white border-[#4f46e5]" : "bg-white text-[#64748b] border-[#e5e7eb] hover:border-[#4f46e5] hover:text-[#4f46e5]"}`}
          >
            <SlidersHorizontal className="w-4 h-4" /> Filters
            {activeFilterCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${showFilters ? "bg-white text-[#4f46e5]" : "bg-[#4f46e5] text-white"}`}>{activeFilterCount}</span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-white border border-[#f0f4ff] rounded-2xl p-5 mb-4 overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
              <div>
                <label className="text-xs font-bold text-[#64748b] uppercase mb-2 block">Work Mode</label>
                <select value={filters.workMode} onChange={e => setFilters(f => ({ ...f, workMode: e.target.value }))} className="w-full border border-[#e5e7eb] rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30">
                  {WORK_MODES.map(m => <option key={m} value={m}>{m === "All" ? "All modes" : m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#64748b] uppercase mb-2 block">Field</label>
                <select value={filters.field} onChange={e => setFilters(f => ({ ...f, field: e.target.value }))} className="w-full border border-[#e5e7eb] rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30">
                  {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#64748b] uppercase mb-2 block">Year</label>
                <select value={filters.year} onChange={e => setFilters(f => ({ ...f, year: e.target.value }))} className="w-full border border-[#e5e7eb] rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30">
                  {YEARS.map(y => <option key={y} value={y}>{y === "All" ? "All years" : `Year ${y}`}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#64748b] uppercase mb-2 block">Min CGPA</label>
                <select value={filters.cgpa} onChange={e => setFilters(f => ({ ...f, cgpa: e.target.value }))} className="w-full border border-[#e5e7eb] rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30">
                  {CGPA_FILTER.map(c => <option key={c} value={c}>{c === "All" ? "Any CGPA" : c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#64748b] uppercase block">Must Have</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={filters.hasGithub} onChange={e => setFilters(f => ({ ...f, hasGithub: e.target.checked }))} className="accent-[#4f46e5]" />
                  <span className="text-sm">GitHub</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={filters.hasProjects} onChange={e => setFilters(f => ({ ...f, hasProjects: e.target.checked }))} className="accent-[#4f46e5]" />
                  <span className="text-sm">Projects</span>
                </label>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#64748b] uppercase block">Availability</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={filters.openOnly} onChange={e => setFilters(f => ({ ...f, openOnly: e.target.checked }))} className="accent-[#4f46e5]" />
                  <span className="text-sm">Open to work only</span>
                </label>
              </div>
            </div>
            <button onClick={() => setFilters({ workMode: "All", field: "All", year: "All", cgpa: "All", hasGithub: false, hasProjects: false, openOnly: false })} className="text-xs text-[#94a3b8] hover:text-[#64748b] font-medium flex items-center gap-1">
              <X className="w-3 h-3" /> Clear all filters
            </button>
          </motion.div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-[#f0f4ff]">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-lg font-bold text-[#0f172a]">No candidates match these filters</p>
            <p className="text-sm text-[#94a3b8] mt-1 mb-4">Try broadening your search or removing some filters</p>
            <button onClick={() => { setSearch(""); setFilters({ workMode: "All", field: "All", year: "All", cgpa: "All", hasGithub: false, hasProjects: false, openOnly: false }); }} className="text-sm font-bold text-[#4f46e5] hover:underline">Clear all</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((student, i) => (
              <motion.div key={student.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.5) }}>
                <StudentCard
                  student={student}
                  shortlisted={shortlisted.includes(student.id)}
                  onShortlist={toggleShortlist}
                  onClick={() => setLocation(`/student/${student.id}`)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
