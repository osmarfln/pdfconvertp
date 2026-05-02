/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'PDF Convert Pro'

// Format a date in Brasília time (America/Sao_Paulo, UTC-3) regardless of
// the server timezone. Edge Functions run in UTC, so calling toLocaleString
// without timeZone would show UTC time labelled as pt-BR (3h ahead of BR).
function formatBrasilia(date: Date = new Date()): string {
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' (Brasília)'
}

interface AdminLoginNotificationProps {
  userName?: string
  userEmail?: string
  provider?: string
  loginAt?: string
}

const AdminLoginNotificationEmail = ({
  userName = 'Usuário',
  userEmail = '-',
  provider = 'google',
  loginAt = formatBrasilia(),
}: AdminLoginNotificationProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{userName} acabou de se conectar à plataforma</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🔔 Novo login na plataforma</Heading>
        <Text style={text}>
          O usuário <strong>{userName}</strong> acabou de se conectar ao{' '}
          {SITE_NAME}.
        </Text>

        <Section style={infoBox}>
          <Text style={infoRow}>
            <strong style={label}>Nome:</strong> {userName}
          </Text>
          <Text style={infoRow}>
            <strong style={label}>Email:</strong> {userEmail}
          </Text>
          <Text style={infoRow}>
            <strong style={label}>Provedor:</strong> {provider}
          </Text>
          <Text style={infoRow}>
            <strong style={label}>Data:</strong> {loginAt}
          </Text>
        </Section>

        <Text style={text}>Vamos dar as boas-vindas! 🎉</Text>

        <Text style={footer}>{SITE_NAME} — Painel Administrativo</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminLoginNotificationEmail,
  subject: (data: Record<string, any>) =>
    `🔔 Novo login: ${data?.userName || 'usuário'} entrou na plataforma`,
  displayName: 'Notificação de login (admin)',
  previewData: {
    userName: 'Maria Silva',
    userEmail: 'maria@example.com',
    provider: 'google',
    loginAt: formatBrasilia(),
  },
} satisfies TemplateEntry

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, Arial, sans-serif',
  margin: 0,
  padding: 0,
}
const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
}
const h1: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#3B82F6',
  margin: '0 0 20px',
}
const text: React.CSSProperties = {
  fontSize: '15px',
  color: '#111318',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const infoBox: React.CSSProperties = {
  background: '#f5f7fb',
  borderRadius: '10px',
  padding: '16px 20px',
  margin: '20px 0',
}
const infoRow: React.CSSProperties = {
  fontSize: '14px',
  color: '#111318',
  margin: '6px 0',
}
const label: React.CSSProperties = {
  color: '#6b7280',
  fontWeight: 600,
  marginRight: '6px',
}
const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#9ca3af',
  marginTop: '32px',
  borderTop: '1px solid #e5e7eb',
  paddingTop: '16px',
}
