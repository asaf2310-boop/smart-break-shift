@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --font-heebo: 'Heebo', sans-serif;
    --background: 220 20% 97%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;
    --primary: 234 89% 62%;
    --primary-foreground: 0 0% 100%;
    --secondary: 220 14% 93%;
    --secondary-foreground: 222 47% 11%;
    --muted: 220 14% 93%;
    --muted-foreground: 220 9% 46%;
    --accent: 262 83% 58%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 98%;
    --border: 220 13% 89%;
    --input: 220 13% 89%;
    --ring: 234 89% 62%;
    --chart-1: 234 89% 62%;
    --chart-2: 262 83% 58%;
    --chart-3: 173 58% 39%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
    --radius: 0.75rem;
    --sidebar-background: 0 0% 98%;
    --sidebar-foreground: 240 5.3% 26.1%;
    --sidebar-primary: 234 89% 62%;
    --sidebar-primary-foreground: 0 0% 98%;
    --sidebar-accent: 240 4.8% 95.9%;
    --sidebar-accent-foreground: 240 5.9% 10%;
    --sidebar-border: 220 13% 91%;
    --sidebar-ring: 234 89% 62%;
  }

  .dark {
    --background: 224 30% 8%;
    --foreground: 210 20% 95%;
    --card: 224 25% 12%;
    --card-foreground: 210 20% 95%;
    --popover: 224 25% 12%;
    --popover-foreground: 210 20% 95%;
    --primary: 234 89% 62%;
    --primary-foreground: 0 0% 100%;
    --secondary: 224 20% 18%;
    --secondary-foreground: 210 20% 95%;
    --muted: 224 20% 18%;
    --muted-foreground: 220 9% 56%;
    --accent: 262 83% 58%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 224 20% 18%;
    --input: 224 20% 18%;
    --ring: 234 89% 62%;
    --chart-1: 234 89% 62%;
    --chart-2: 262 83% 58%;
    --chart-3: 173 58% 39%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
    --sidebar-background: 224 30% 8%;
    --sidebar-foreground: 210 20% 95%;
    --sidebar-primary: 234 89% 62%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 224 20% 18%;
    --sidebar-accent-foreground: 210 20% 95%;
    --sidebar-border: 224 20% 18%;
    --sidebar-ring: 234 89% 62%;
  }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground font-heebo;
  }
}