# 🤖 Especificación: Auto-completado de Parámetros con IA (Gemini)

## Resumen
Implementar un endpoint que use **Gemini API** para analizar los nombres de parámetros de plantillas de WhatsApp y sugerir automáticamente el tipo de asignación (`assign_type`) y valor (`assign_value`) más apropiado.

---

## 📍 Endpoint Requerido

### `POST /api/bots/{bot_id}/notifications/campaigns/suggest-mappings`

**Descripción**: Analiza los parámetros de una plantilla y devuelve sugerencias inteligentes sobre cómo mapearlos.

---

## 📥 Request Body (JSON)

```json
{
  "parameters": [
    {
      "param_index": 1,
      "param_name": "nombre",
      "param_example": "Juan Pérez"
    },
    {
      "param_index": 2,
      "param_name": "titulo_evento",
      "param_example": "Webinar de Marketing Digital"
    },
    {
      "param_index": 3,
      "param_name": "fecha_hora",
      "param_example": "15 de marzo, 10:00 AM"
    }
  ],
  "available_contact_fields": [
    "name",
    "phone_number",
    "email",
    "first_name",
    "last_name",
    "company"
  ],
  "event_data": {
    "title": "Webinar en vivo: Estrategias 2026",
    "description": "Aprende las mejores técnicas...",
    "brand": "TechCorp",
    "topic": "Marketing Digital"
  },
  "session_data": {
    "name": "Workshop de casos 3D",
    "start_at": "2026-03-15T10:00:00Z",
    "end_at": "2026-03-15T12:00:00Z",
    "location_name": "Auditorio Principal",
    "location_address": "Calle 123 #45-67",
    "meeting_link": "https://zoom.us/j/123456789",
    "speaker_name": "Dr. García López"
  }
}
```

### 📋 Campos del Request

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `parameters` | `Array<Object>` | Lista de parámetros de la plantilla |
| `parameters[].param_index` | `int` | Posición del parámetro (1, 2, 3...) |
| `parameters[].param_name` | `string` | Alias/nombre del parámetro |
| `parameters[].param_example` | `string?` | Ejemplo del valor (opcional) |
| `available_contact_fields` | `Array<string>` | Campos disponibles en los contactos |
| `event_data` | `Object?` | Datos del evento (si existe) |
| `session_data` | `Object?` | Datos de la sesión (si existe) |

---

## 📤 Response Body (JSON)

```json
{
  "suggestions": [
    {
      "param_index": 1,
      "assign_type": "contact_field",
      "assign_value": "name",
      "reasoning": "El parámetro 'nombre' claramente se refiere al nombre del contacto."
    },
    {
      "param_index": 2,
      "assign_type": "event_field",
      "assign_value": "event.title",
      "reasoning": "El parámetro 'titulo_evento' debe usar el título del evento."
    },
    {
      "param_index": 3,
      "assign_type": "fixed_value",
      "assign_value": "15 de marzo de 2026, 10:00 AM",
      "reasoning": "Fecha y hora formateadas desde session.start_at."
    }
  ]
}
```

### 📋 Campos del Response

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `suggestions` | `Array<Object>` | Lista de sugerencias |
| `suggestions[].param_index` | `int` | Índice del parámetro |
| `suggestions[].assign_type` | `string` | Tipo: `'contact_field'`, `'event_field'`, o `'fixed_value'` |
| `suggestions[].assign_value` | `string` | El valor a asignar |
| `suggestions[].reasoning` | `string?` | Explicación de la decisión (opcional) |

---

## 🧠 Lógica de IA (Gemini)

### Prompt Sugerido para Gemini

```text
Eres un asistente experto en mapear parámetros de plantillas de WhatsApp.

Tienes una lista de parámetros de una plantilla que deben ser completados. Tu trabajo es decidir cómo debe llenarse cada uno.

REGLAS:
1. Si el parámetro se refiere a información del CONTACTO (nombre, teléfono, email, empresa, etc.), usa:
   - assign_type: "contact_field"
   - assign_value: el nombre del campo del contacto (debe estar en la lista de campos disponibles)

2. Si el parámetro se refiere a información del EVENTO o SESIÓN (título, fecha, hora, ubicación, speaker, link), usa:
   - assign_type: "event_field"
   - assign_value: una de estas claves:
     * event.title, event.description, event.brand, event.topic
     * session.name, session.start_at, session.end_at, session.location_name, session.location_address, session.meeting_link, session.speaker_name

3. Si el parámetro menciona FECHA u HORA y están disponibles los datos de la sesión, usa:
   - assign_type: "fixed_value"
   - assign_value: la fecha/hora formateada en español desde session.start_at
   - IMPORTANTE: Si dice "fecha" y "hora" en parámetros SEPARADOS, formatéalos independientemente.

4. Si el parámetro menciona BENEFICIO, FRASE MOTIVACIONAL o algo relacionado con el tema del evento, usa:
   - assign_type: "fixed_value"
   - assign_value: crea una frase corta relacionada con el tema del evento

DATOS DISPONIBLES:
- Campos de contacto: {available_contact_fields}
- Evento: {event_data}
- Sesión: {session_data}

PARÁMETROS A MAPEAR:
{parameters}

RESPONDE EN FORMATO JSON:
{
  "suggestions": [
    {
      "param_index": 1,
      "assign_type": "contact_field",
      "assign_value": "name",
      "reasoning": "..."
    }
  ]
}
```

### Ejemplo de Implementación (Python/FastAPI)

```python
import os
import json
import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

router = APIRouter()

# Configurar Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.0-flash-exp')

class ParameterInfo(BaseModel):
    param_index: int
    param_name: str
    param_example: Optional[str] = None

class SuggestMappingsRequest(BaseModel):
    parameters: List[ParameterInfo]
    available_contact_fields: List[str]
    event_data: Optional[Dict[str, Any]] = None
    session_data: Optional[Dict[str, Any]] = None

class ParameterSuggestion(BaseModel):
    param_index: int
    assign_type: str
    assign_value: str
    reasoning: Optional[str] = None

class SuggestMappingsResponse(BaseModel):
    suggestions: List[ParameterSuggestion]

@router.post("/bots/{bot_id}/notifications/campaigns/suggest-mappings")
async def suggest_parameter_mappings(
    bot_id: str,
    request: SuggestMappingsRequest
) -> SuggestMappingsResponse:
    """
    Usa Gemini para sugerir el mapeo de parámetros de plantilla.
    """
    
    # Construir el prompt
    prompt = f"""
Eres un asistente experto en mapear parámetros de plantillas de WhatsApp.

Tienes una lista de parámetros de una plantilla que deben ser completados. Tu trabajo es decidir cómo debe llenarse cada uno.

REGLAS:
1. Si el parámetro se refiere a información del CONTACTO (nombre, teléfono, email, empresa, etc.), usa:
   - assign_type: "contact_field"
   - assign_value: el nombre del campo del contacto (debe estar en la lista de campos disponibles)

2. Si el parámetro se refiere a información del EVENTO o SESIÓN (título, fecha, hora, ubicación, speaker, link), usa:
   - assign_type: "event_field"
   - assign_value: una de estas claves:
     * event.title, event.description, event.brand, event.topic
     * session.name, session.start_at, session.end_at, session.location_name, session.location_address, session.meeting_link, session.speaker_name

3. Si el parámetro menciona FECHA u HORA y están disponibles los datos de la sesión, usa:
   - assign_type: "fixed_value"
   - assign_value: la fecha/hora formateada en español desde session.start_at
   - IMPORTANTE: Si dice "fecha" y "hora" en parámetros SEPARADOS, formatéalos independientemente.

4. Si el parámetro menciona BENEFICIO, FRASE MOTIVACIONAL o algo relacionado con el tema del evento, usa:
   - assign_type: "fixed_value"
   - assign_value: crea una frase corta relacionada con el tema del evento

DATOS DISPONIBLES:
- Campos de contacto: {json.dumps(request.available_contact_fields, ensure_ascii=False)}
- Evento: {json.dumps(request.event_data, ensure_ascii=False) if request.event_data else "No disponible"}
- Sesión: {json.dumps(request.session_data, ensure_ascii=False) if request.session_data else "No disponible"}

PARÁMETROS A MAPEAR:
{json.dumps([p.dict() for p in request.parameters], ensure_ascii=False)}

RESPONDE ÚNICAMENTE EN FORMATO JSON (sin markdown, sin ```):
{{
  "suggestions": [
    {{
      "param_index": 1,
      "assign_type": "contact_field",
      "assign_value": "name",
      "reasoning": "..."
    }}
  ]
}}
"""

    try:
        # Llamar a Gemini
        response = model.generate_content(prompt)
        
        # Limpiar respuesta (remover markdown si existe)
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        # Parsear JSON
        result = json.loads(text)
        
        return SuggestMappingsResponse(suggestions=result.get("suggestions", []))
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Error parsing AI response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calling AI: {str(e)}")
```

---

## ✅ Casos de Prueba

### Caso 1: Parámetros de Contacto
**Input:**
```json
{
  "parameters": [
    {"param_index": 1, "param_name": "nombre_cliente"},
    {"param_index": 2, "param_name": "email"}
  ],
  "available_contact_fields": ["name", "email", "phone_number"]
}
```

**Output Esperado:**
```json
{
  "suggestions": [
    {"param_index": 1, "assign_type": "contact_field", "assign_value": "name"},
    {"param_index": 2, "assign_type": "contact_field", "assign_value": "email"}
  ]
}
```

### Caso 2: Datos de Evento
**Input:**
```json
{
  "parameters": [
    {"param_index": 1, "param_name": "titulo"},
    {"param_index": 2, "param_name": "ubicacion"}
  ],
  "available_contact_fields": ["name"],
  "event_data": {"title": "Webinar 2026"},
  "session_data": {"location_name": "Zoom"}
}
```

**Output Esperado:**
```json
{
  "suggestions": [
    {"param_index": 1, "assign_type": "event_field", "assign_value": "event.title"},
    {"param_index": 2, "assign_type": "event_field", "assign_value": "session.location_name"}
  ]
}
```

### Caso 3: Fecha/Hora
**Input:**
```json
{
  "parameters": [
    {"param_index": 1, "param_name": "fecha"},
    {"param_index": 2, "param_name": "hora"}
  ],
  "session_data": {"start_at": "2026-03-15T10:00:00Z"}
}
```

**Output Esperado:**
```json
{
  "suggestions": [
    {"param_index": 1, "assign_type": "fixed_value", "assign_value": "15 de marzo de 2026"},
    {"param_index": 2, "assign_type": "fixed_value", "assign_value": "10:00 AM"}
  ]
}
```

---

## 🔑 Variables de Entorno

Asegúrate de tener configurada la API Key de Gemini:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 📦 Dependencias (Python)

```bash
pip install google-generativeai
```

---

## ⚠️ Consideraciones Importantes

1. **Rate Limits**: Gemini tiene límites de llamadas por minuto. Considera implementar caché o throttling.
2. **Timeouts**: Las llamadas a la API pueden tardar 2-5 segundos. Usa timeouts apropiados.
3. **Fallbacks**: Si Gemini falla, devolver una lista vacía o un error claro.
4. **Seguridad**: No enviar información sensible (números de teléfono, emails reales) a la IA. Solo enviar los nombres de los campos.
5. **Formato de Fechas**: Asegúrate de formatear las fechas en español con la zona horaria correcta.

---

## 🎯 Resultado Final

El usuario podrá:
1. Entrar a una campaña
2. Click en el botón **"Autocompletar con IA"** (con ícono de bombilla/cerebro)
3. La IA analiza los nombres de los parámetros
4. Los campos se llenan automáticamente
5. El usuario puede ajustar manualmente si es necesario
6. Guardar los parámetros

¡Esto ahorrará MUCHO tiempo al configurar campañas! 🚀
