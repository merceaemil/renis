<#import "template.ftl" as layout>
<@layout.emailLayout>
<p>${msg("executeActionsGreeting", (user.firstName!""))}</p>
<p>${msg("executeActionsIntro")}</p>
<p>${msg("executeActionsPasswordHint")}</p>
<p><a href="${link}">${msg("executeActionsOpenPlatform")}</a></p>
<p>${msg("executeActionsLinkLifespan")}</p>
</@layout.emailLayout>
