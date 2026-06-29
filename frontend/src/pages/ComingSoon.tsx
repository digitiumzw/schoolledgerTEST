/**
 * Coming Soon Page
 * 
 * A placeholder page for the subscription feature that is under development.
 * Displays a clean, professional coming soon message with relevant information.
 */

import { Crown, Clock, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ComingSoon() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full border-2 border-primary/20">
        <CardHeader className="text-center pb-8">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Crown className="h-10 w-10 text-primary" />
          </div>
          
          {/* Title */}
          <CardTitle className="text-4xl font-bold mb-2">
            Coming Soon
          </CardTitle>
          
          {/* Badge */}
          <Badge variant="secondary" className="mb-4">
            <Clock className="h-3 w-3 mr-1" />
            Under Development
          </Badge>
          
          {/* Description */}
          <p className="text-xl text-muted-foreground">
            Subscription Management Portal
          </p>
        </CardHeader>
        
        <CardContent className="text-center space-y-6">
          {/* Main Message */}
          <p className="text-muted-foreground text-lg leading-relaxed">
            We're working hard to bring you a powerful subscription management system. 
            This portal will allow you to easily manage your school's subscription plans, 
            view billing information, and access premium features.
          </p>
          
          {/* Features List */}
          <div className="bg-muted/50 rounded-lg p-6 text-left">
            <h3 className="font-semibold text-lg mb-4 text-center">What to expect:</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 bg-primary rounded-full"></div>
                <span>Flexible subscription plans tailored to your school's needs</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 bg-primary rounded-full"></div>
                <span>Transparent billing with detailed invoices</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 bg-primary rounded-full"></div>
                <span>Easy plan upgrades and downgrades</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 bg-primary rounded-full"></div>
                <span>Automatic payment processing</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 bg-primary rounded-full"></div>
                <span>Usage analytics and insights</span>
              </li>
            </ul>
          </div>
          
          {/* Timeline */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Expected Release</p>
            <p className="text-2xl font-bold text-primary">Q2 2024</p>
          </div>
          
          {/* Contact CTA */}
          <div className="bg-primary/5 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Have questions about our subscription plans?
            </p>
            <Button variant="outline" className="gap-2">
              <Mail className="h-4 w-4" />
              Contact Support
            </Button>
          </div>
          
          {/* Footer Note */}
          <p className="text-xs text-muted-foreground pt-4 border-t">
            In the meantime, you can continue using all available features of SchoolLedger. 
            Your current subscription status remains unchanged.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
