/**
 * "Este build é o ambiente de teste?" — a única fonte da resposta.
 *
 * Vem de `NEXT_PUBLIC_AMBIENTE`, definida SÓ no escopo Preview da Vercel. Como
 * é `NEXT_PUBLIC_`, o valor é embutido no bundle na hora do build, então
 * funciona igual no servidor e no cliente — que é o necessário: a tarja é
 * renderizada no servidor e o botão do WhatsApp é componente de cliente.
 *
 * Na produção a variável não existe, então tudo isto some sozinho: nenhuma
 * tarja, e o WhatsApp abre normalmente. **Não troque por checagem de hostname**
 * — a URL de preview muda a cada deploy, e a regra passaria a depender de um
 * dado que ninguém controla.
 *
 * Importante: mudar esta variável exige REBUILD. `NEXT_PUBLIC_` é embutida no
 * bundle, não lida em tempo de execução.
 */
export const EH_AMBIENTE_TESTE = process.env.NEXT_PUBLIC_AMBIENTE === "teste";
