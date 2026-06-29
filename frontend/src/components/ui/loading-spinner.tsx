import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '',
  text 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="flex flex-col items-center space-y-2">
        <div 
          className={cn(
            'animate-spin rounded-full border-b-2 border-primary',
            sizeClasses[size]
          )}
        />
        {text && (
          <p className="text-sm text-muted-foreground animate-pulse">
            {text}
          </p>
        )}
      </div>
    </div>
  );
};

interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  children: React.ReactNode;
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  isLoading, 
  text = 'Loading...', 
  children,
  className = ''
}) => {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
          <LoadingSpinner text={text} />
        </div>
      )}
    </div>
  );
};

interface PageLoadingProps {
  text?: string;
  minHeight?: string;
}

export const PageLoading: React.FC<PageLoadingProps> = ({ 
  text = 'Loading...', 
  minHeight = 'min-h-[400px]' 
}) => {
  return (
    <div className={cn('flex items-center justify-center w-full', minHeight)}>
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
};
