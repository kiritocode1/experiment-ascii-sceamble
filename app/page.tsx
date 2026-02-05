import { ASCIIText } from "./ascii-text"

export default function Page() {
  // ASCII Fluid Text Demo
  return (
    <main className="min-h-screen bg-[#121211] text-[#f9f9f7] font-mono">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-12">
        {/* Header */}
        <header className="space-y-2">
          <ASCIIText
            as="h1"
            className="text-2xl font-normal tracking-tight"
            duration={2800}
            waveSpeed={120}
            spread={0.2}
          >
            ASCII Fluid Text Component
          </ASCIIText>
          <ASCIIText
            as="p"
            className="text-[#bdbdbd] text-sm"
            duration={600}
          >
            Hover over any text to see the wave ripple effect
          </ASCIIText>
        </header>

        {/* Example paragraphs - 2D wave effect works on multi-line text */}
        <section className="space-y-6">
          <ASCIIText className="text-base leading-relaxed"
          duration={2800}
          waveSpeed={120}
          spread={0.2}
          
          >
            The universe is made of stories, not of atoms. Each moment we spend exploring the cosmos reveals new mysteries waiting to be unraveled. The stars whisper secrets to those who listen, painting the night sky with ancient light that has traveled millions of years to reach our eyes.
          </ASCIIText>

          <ASCIIText
            className="text-base leading-relaxed"
            duration={2000}
            waveSpeed={120}

            spread={0.2}
          >
            In the depths of digital space, characters dance and transform, creating ripples of meaning that cascade through the void of the screen. Each keystroke echoes through the silicon corridors, leaving traces of thought encoded in the fabric of the machine.
          </ASCIIText>

          <ASCIIText
            className="text-lg leading-relaxed font-medium"
            chars="01"
            duration={1500}
            waveSpeed={200}
          >
            Binary dreams pulse through silicon veins. The code awakens at midnight, speaking in tongues of logic and loops.
          </ASCIIText>
        </section>

        {/* Book list example */}
        <section className="space-y-4">
          <ASCIIText as="h2" className="text-lg font-medium border-b border-[#333] pb-2">
            Recommended Reading
          </ASCIIText>

          <ul className="space-y-3">
            {[
              "Roadside Picnic — Arkady & Boris Strugatsky",
              "The City & the City — China Miéville",
              "Parable of the Sower — Octavia E. Butler",
              "The Fifth Head of Cerberus — Gene Wolfe",
              "Riddley Walker — Russell Hoban",
              "His Master's Voice — Stanisław Lem",
              "The Left Hand of Darkness — Ursula K. Le Guin",
            ].map((book) => (
              <li key={book} className="flex items-center gap-3">
                <span className="w-2 h-px bg-[#f9f9f7]" />
                <ASCIIText
                  as="span"
                  className="text-sm hover:text-white transition-colors"
                  duration={1000}
                  waveSpeed={180}
                  spread={0.2}
                  chars="01"
                >
                  {book}
                </ASCIIText>
              </li>
            ))}
          </ul>
        </section>

        {/* Different heading sizes */}
        <section className="space-y-4">
          <ASCIIText as="h2" className="text-lg font-medium border-b border-[#333] pb-2">
            Typography Examples
          </ASCIIText>

          <div className="space-y-3">
            <ASCIIText as="h1" className="text-3xl tracking-tight">
              Heading One
            </ASCIIText>
            <ASCIIText as="h2" className="text-2xl tracking-tight">
              Heading Two
            </ASCIIText>
            <ASCIIText as="h3" className="text-xl">
              Heading Three
            </ASCIIText>
            <ASCIIText as="h4" className="text-lg">
              Heading Four
            </ASCIIText>
            <ASCIIText className="text-base text-[#bdbdbd]">
              Regular paragraph text with muted color
            </ASCIIText>
            <ASCIIText as="span" className="text-sm text-[#888]">
              Small inline span element
            </ASCIIText>
          </div>
        </section>

        {/* Custom character sets */}
        <section className="space-y-4">
          <ASCIIText as="h2" className="text-lg font-medium border-b border-[#333] pb-2">
            Custom Character Sets
          </ASCIIText>

          <div className="space-y-3">
            <ASCIIText
              chars="░▒▓█"
              duration={1200}
              waveSpeed={150}
              className="text-base"
            >
              Block characters only
            </ASCIIText>

            <ASCIIText
              chars="╔╗╚╝║═╬╣╠╩╦"
              duration={1400}
              waveSpeed={140}
              className="text-base"
            >
              Box drawing characters
            </ASCIIText>

            <ASCIIText
              chars="@#$%&*"
              duration={1000}
              waveSpeed={200}
              className="text-base"
            >
              Symbol explosion mode
            </ASCIIText>

            <ASCIIText
              chars="·•○●◦◌"
              duration={1500}
              waveSpeed={130}
              className="text-base"
            >
              Dot matrix style
            </ASCIIText>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-[#333]">
          <ASCIIText
            as="p"
            className="text-xs text-[#666] text-center"
            duration={1200}
            spread={1}
          >
            ASCII Fluid Text Component — React/TypeScript
          </ASCIIText>
        </footer>
      </div>
    </main>
  )
}