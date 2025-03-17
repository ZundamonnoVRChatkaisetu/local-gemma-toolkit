"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Home', href: '/', icon: '🏠' },
  { label: 'Chat', href: '/chat', icon: '💬' },
  { label: 'DeepSearch', href: '/search', icon: '🔍' },
  { label: 'Learning', href: '/learn', icon: '📚' },
  { label: 'Security', href: '/security', icon: '🔒' },
];

export function MainNav() {
  const pathname = usePathname();
  
  return (
    <nav className="flex space-x-4">
      {navItems.map((item) => (
        <Link 
          key={item.href} 
          href={item.href}
          className={cn(
            "px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100",
            pathname === item.href 
              ? "bg-gray-100 text-gray-900" 
              : "text-gray-500"
          )}
        >
          <span className="mr-2">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
