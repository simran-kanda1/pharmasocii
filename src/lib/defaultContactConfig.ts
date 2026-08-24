export interface ContactDepartment {
    id: string;
    title: string;
    email: string;
    phone?: string;
    description?: string;
    hours?: string;
    icon?: string;
}

export interface ContactConfig {
    headline: string;
    subtitle: string;
    description: string;
    globalPhone?: string;
    globalAddress?: string;
    globalHours?: string;
    showContactForm: boolean;
    departments: ContactDepartment[];
}

export const DEFAULT_CONTACT_CONFIG: ContactConfig = {
    headline: "Contact Us",
    subtitle: "Got Questions?",
    description: "We are here to support your collaboration and growth across the life sciences ecosystem. Reach out to our specialized teams below.",
    globalPhone: "",
    globalAddress: "",
    globalHours: "Monday – Friday: 9:00 AM – 6:00 PM EST",
    showContactForm: true,
    departments: [
        {
            id: "general",
            title: "General Inquiries",
            email: "general@pharmasocii.com",
            phone: "",
            description: "General questions, platform overview, press inquiries, and public information.",
            hours: "Mon – Fri: 9:00 AM – 6:00 PM EST",
            icon: "HelpCircle"
        },
        {
            id: "member",
            title: "Member Support",
            email: "admin@pharmasocii.com",
            phone: "",
            description: "Assistance with member profiles, community engagement, bookmarks, and account access.",
            hours: "Mon – Fri: 9:00 AM – 6:00 PM EST",
            icon: "Users"
        },
        {
            id: "tech",
            title: "Technical Support (IT)",
            email: "tech@pharmasocii.com",
            phone: "",
            description: "Bug reports, platform performance issues, login troubleshooting, and technical assistance.",
            hours: "24/7 Monitoring & Escalations",
            icon: "Wrench"
        },
        {
            id: "partner",
            title: "Partner Support",
            email: "partners@pharmasocii.com",
            phone: "",
            description: "Partner listing management, premium subscriptions, spotlight plans, and business collaborations.",
            hours: "Mon – Fri: 9:00 AM – 6:00 PM EST",
            icon: "Handshake"
        },
        {
            id: "legal",
            title: "Legal Inquiries",
            email: "legal@pharmasocii.com",
            phone: "",
            description: "Terms of service, privacy requests, intellectual property, compliance, and regulatory notices.",
            hours: "Mon – Fri: 9:00 AM – 5:00 PM EST",
            icon: "Scale"
        }
    ]
};
