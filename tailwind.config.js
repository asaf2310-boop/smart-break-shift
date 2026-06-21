/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			noto: ['var(--font-noto)'],
  			sans: ['var(--font-sans)'],
  			heebo: ['var(--font-heebo)'],
  			caveat: ['Caveat', 'Segoe Script', 'cursive']
  		},
  		backgroundImage: {
  			'brand-gradient': 'var(--brand-gradient)',
  			'brand-gradient-hover': 'var(--brand-gradient-hover)'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 4px)',
  			sm: 'calc(var(--radius) - 8px)',
  			xl: 'calc(var(--radius) + 4px)',
  			'2xl': 'calc(var(--radius) + 8px)',
  			'3xl': 'calc(var(--radius) + 12px)'
  		},
  		boxShadow: {
  			'elevation-1': 'var(--elevation-1)',
  			'elevation-2': 'var(--elevation-2)',
  			'elevation-3': 'var(--elevation-3)'
  		},
  		colors: {
  			brand: {
  				bg: 'var(--brand-bg)',
  				surface: 'var(--brand-surface)',
  				purple: 'var(--brand-purple)',
  				'purple-light': 'var(--brand-purple-light)',
  				cyan: 'var(--brand-cyan)'
  			},
  			hyp: {
  				blue: 'var(--hyp-brand-blue)',
  				'blue-light': 'var(--hyp-brand-blue-light)',
  				teal: 'var(--hyp-brand-teal)',
  				'text-primary': 'var(--hyp-text-primary)',
  				'text-secondary': 'var(--hyp-text-secondary)',
  				bg: 'var(--hyp-bg)',
  				'bg-alt': 'var(--hyp-bg-alt)'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			'primary-container': 'hsl(var(--primary-container))',
  			'on-primary-container': 'hsl(var(--on-primary-container))',
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			outline: 'hsl(var(--outline))',
  			'outline-variant': 'hsl(var(--outline-variant))',
  			surface: 'hsl(var(--surface))',
  			'surface-container-lowest': 'hsl(var(--surface-container-lowest))',
  			'surface-container-low': 'hsl(var(--surface-container-low))',
  			'surface-container': 'hsl(var(--surface-container))',
  			'surface-container-high': 'hsl(var(--surface-container-high))',
  			'on-surface-variant': 'hsl(var(--on-surface-variant))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
