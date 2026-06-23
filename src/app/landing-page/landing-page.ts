import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FeatureCard {
  icon: string;
  title: string;
  description: string;
  tone: 'pink' | 'blue' | 'amber' | 'green';
}

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPage {
  protected readonly features: FeatureCard[] = [
    {
      icon: 'AI',
      title: 'AI-Powered Career Documents',
      description: 'Turn career files into structured profile data ready for review, edits, and regeneration.',
      tone: 'pink',
    },
    {
      icon: 'GL',
      title: 'Template-Ready Output',
      description: 'Preview saved documents in professional templates before exporting PDF or Word versions.',
      tone: 'blue',
    },
    {
      icon: '5m',
      title: 'Ready in Minutes',
      description: 'Upload, inspect, edit, and regenerate polished application documents without slow formatting.',
      tone: 'amber',
    },
    {
      icon: 'OK',
      title: 'Review-Friendly Editing',
      description: 'Adjust skills, experience, education, certifications, and summaries while preserving source data.',
      tone: 'green',
    },
  ];
}
